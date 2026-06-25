use git2::{Commit, IndexAddOption, Oid, Repository, Signature, StatusOptions};
use std::{fs, path::{Path, PathBuf}};

pub struct GitHistory {
    repo: Repository,
    worktree: PathBuf,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitVersionEntry {
    pub id: String,
    pub title: String,
    pub updated_at: u64,
    pub summary: String,
}

impl GitHistory {
    pub fn open(worktree: PathBuf) -> Result<Self, git2::Error> {
        let repo = match Repository::discover(&worktree) {
            Ok(repo) => repo,
            Err(_) => Repository::init(&worktree)?,
        };
        Ok(Self { repo, worktree })
    }

    fn signature(&self) -> Result<Signature<'_>, git2::Error> {
        Signature::now("NoteForge", "noteforge@local")
    }

    pub fn ensure_repo_ready(&self) -> Result<(), git2::Error> {
        if self.repo.is_bare() {
            return Err(git2::Error::from_str("bare repository is not supported"));
        }
        Ok(())
    }

    pub fn commit_note(&self, note_id: &str, title: &str, content: &str) -> Result<Option<String>, git2::Error> {
        self.ensure_repo_ready()?;
        let note_dir = self.worktree.join("notes");
        let _ = fs::create_dir_all(&note_dir);
        let file_path = note_dir.join(format!("{}.md", note_id));
        if let Some(parent) = file_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        fs::write(&file_path, content).map_err(|e| git2::Error::from_str(&e.to_string()))?;

        let mut index = self.repo.index()?;
        index.add_path(Path::new(&format!("notes/{}.md", note_id)))?;
        index.write()?;

        let tree_id = index.write_tree()?;
        let tree = self.repo.find_tree(tree_id)?;
        let sig = self.signature()?;
        let message = format!("note: {}", title);
        let parent = self.repo.head().ok().and_then(|h| h.target()).and_then(|oid| self.repo.find_commit(oid).ok());
        let commit_id = if let Some(parent_commit) = parent {
            self.repo.commit(Some("HEAD"), &sig, &sig, &message, &tree, &[&parent_commit])?
        } else {
            self.repo.commit(Some("HEAD"), &sig, &sig, &message, &tree, &[])?
        };
        Ok(Some(commit_id.to_string()))
    }

    pub fn list_versions(&self, note_id: &str) -> Result<Vec<GitVersionEntry>, git2::Error> {
        let mut revwalk = self.repo.revwalk()?;
        revwalk.push_head()?;
        let mut entries = Vec::new();
        for oid in revwalk.flatten() {
            let commit = self.repo.find_commit(oid)?;
            let message = commit.summary().unwrap_or("").to_string();
            let content = self.commit_contains_note(&commit, note_id)?;
            if !content {
                continue;
            }
            entries.push(GitVersionEntry {
                id: oid.to_string(),
                title: message.clone(),
                updated_at: commit.time().seconds().max(0) as u64 * 1000,
                summary: message,
            });
            if entries.len() >= 20 {
                break;
            }
        }
        Ok(entries)
    }

    pub fn checkout_version(&self, commit_id: &str, note_id: &str) -> Result<String, git2::Error> {
        let commit = self.repo.find_commit(Oid::from_str(commit_id)?)?;
        let tree = commit.tree()?;
        let path = Path::new(&format!("notes/{}.md", note_id));
        let entry = tree.get_path(path)?;
        let blob = self.repo.find_blob(entry.id())?;
        Ok(String::from_utf8_lossy(blob.content()).to_string())
    }

    fn commit_contains_note(&self, commit: &Commit<'_>, note_id: &str) -> Result<bool, git2::Error> {
        let tree = commit.tree()?;
        Ok(tree.get_path(Path::new(&format!("notes/{}.md", note_id))).is_ok())
    }
}
