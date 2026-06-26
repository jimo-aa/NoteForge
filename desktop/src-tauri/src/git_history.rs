use git2::{BranchType, Oid, Repository, Signature};
use std::{fs, path::{Path, PathBuf}};

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitVersionEntry {
    pub id: String,
    pub title: String,
    pub updated_at: u64,
    pub summary: String,
    pub branch: String,
    pub parent_count: u32,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitBranchEntry {
    pub name: String,
    pub head: Option<String>,
    pub is_current: bool,
}

pub struct GitHistory {
    repo: Repository,
    worktree: PathBuf,
}

impl GitHistory {
    pub fn open(worktree: PathBuf) -> Result<Self, git2::Error> {
        let repo = match Repository::discover(&worktree) {
            Ok(repo) => repo,
            Err(_) => Repository::init(&worktree)?,
        };
        Ok(Self { repo, worktree })
    }

    fn branch_ref(&self, note_id: &str, branch: &str) -> String {
        format!("refs/heads/notes/{}/{}", note_id, branch)
    }

    fn current_branch(&self, note_id: &str) -> String {
        self.repo
            .find_reference(&format!("refs/notes/{}/current", note_id))
            .ok()
            .and_then(|r| r.symbolic_target().map(|s| s.rsplit('/').next().unwrap_or("main").to_string()))
            .unwrap_or_else(|| "main".to_string())
    }

    fn set_current_branch(&self, note_id: &str, branch: &str) -> Result<(), git2::Error> {
        self.repo.reference_symbolic(
            &format!("refs/notes/{}/current", note_id),
            &self.branch_ref(note_id, branch),
            true,
            "switch branch",
        )?;
        Ok(())
    }

    fn signature(&self) -> Result<Signature<'_>, git2::Error> {
        Signature::now("NoteForge", "noteforge@local")
    }

    fn ensure_note_path(&self, note_id: &str) -> Result<PathBuf, git2::Error> {
        let note_dir = self.worktree.join("notes");
        fs::create_dir_all(&note_dir).map_err(|e| git2::Error::from_str(&e.to_string()))?;
        Ok(note_dir.join(format!("{}.md", note_id)))
    }

    fn commit_from_head(&self, note_id: &str, branch: &str, title: &str, content: &str) -> Result<String, git2::Error> {
        let file_path = self.ensure_note_path(note_id)?;
        fs::write(&file_path, content).map_err(|e| git2::Error::from_str(&e.to_string()))?;
        let mut index = self.repo.index()?;
        index.add_path(Path::new(&format!("notes/{}.md", note_id)))?;
        index.write()?;
        let tree_id = index.write_tree()?;
        let tree = self.repo.find_tree(tree_id)?;
        let sig = self.signature()?;
        let branch_ref = self.branch_ref(note_id, branch);
        let parent = self.repo.find_reference(&branch_ref).ok().and_then(|r| r.target()).and_then(|oid| self.repo.find_commit(oid).ok());
        let message = format!("note: {} [{}]", title, branch);
        let oid = match parent {
            Some(parent_commit) => self.repo.commit(Some(&branch_ref), &sig, &sig, &message, &tree, &[&parent_commit])?,
            None => self.repo.commit(Some(&branch_ref), &sig, &sig, &message, &tree, &[])?
        };
        self.set_current_branch(note_id, branch)?;
        Ok(oid.to_string())
    }

    pub fn commit_note(&self, note_id: &str, title: &str, content: &str) -> Result<String, git2::Error> {
        let branch = self.current_branch(note_id);
        self.commit_from_head(note_id, &branch, title, content)
    }

    pub fn list_versions(&self, note_id: &str) -> Result<Vec<GitVersionEntry>, git2::Error> {
        let branch = self.current_branch(note_id);
        let refname = self.branch_ref(note_id, &branch);
        let mut revwalk = self.repo.revwalk()?;
        if let Ok(reference) = self.repo.find_reference(&refname) {
            if let Some(oid) = reference.target() { revwalk.push(oid)?; }
        }
        let mut entries = Vec::new();
        for oid in revwalk.flatten() {
            let commit = self.repo.find_commit(oid)?;
            entries.push(GitVersionEntry {
                id: oid.to_string(),
                title: commit.summary().unwrap_or("版本").to_string(),
                updated_at: commit.time().seconds().max(0) as u64 * 1000,
                summary: commit.message().unwrap_or("").to_string(),
                branch: branch.clone(),
                parent_count: commit.parent_count() as u32,
            });
        }
        Ok(entries)
    }

    pub fn list_branches(&self, note_id: &str) -> Result<Vec<GitBranchEntry>, git2::Error> {
        let current = self.current_branch(note_id);
        let prefix = format!("notes/{}/", note_id);
        let mut branches = Vec::new();
        for branch in self.repo.branches(Some(BranchType::Local))? {
            let (branch, _) = branch?;
            if let Some(name) = branch.name()? {
                if name.starts_with(&prefix) {
                    let short = name.trim_start_matches(&prefix).to_string();
                    branches.push(GitBranchEntry { name: short.clone(), head: branch.get().target().map(|oid| oid.to_string()), is_current: short == current });
                }
            }
        }
        if branches.is_empty() { branches.push(GitBranchEntry { name: "main".to_string(), head: None, is_current: true }); }
        Ok(branches)
    }

    pub fn create_branch(&self, note_id: &str, branch: &str, from_commit: Option<&str>) -> Result<(), git2::Error> {
        let commit = if let Some(commit_id) = from_commit { self.repo.find_commit(Oid::from_str(commit_id)?)? } else {
            let current = self.current_branch(note_id);
            let refname = self.branch_ref(note_id, &current);
            let reference = self.repo.find_reference(&refname)?;
            self.repo.find_commit(reference.target().ok_or_else(|| git2::Error::from_str("missing head"))?)?
        };
        let branch_ref = self.branch_ref(note_id, branch);
        self.repo.branch(&branch_ref, &commit, true)?;
        self.set_current_branch(note_id, branch)?;
        Ok(())
    }

    pub fn checkout_branch(&self, note_id: &str, branch: &str) -> Result<String, git2::Error> {
        self.set_current_branch(note_id, branch)?;
        let refname = self.branch_ref(note_id, branch);
        let reference = self.repo.find_reference(&refname)?;
        let commit = self.repo.find_commit(reference.target().ok_or_else(|| git2::Error::from_str("missing head"))?)?;
        self.checkout_commit_tree(note_id, &commit)
    }

    pub fn checkout_version(&self, commit_id: &str, note_id: &str) -> Result<String, git2::Error> {
        let commit = self.repo.find_commit(Oid::from_str(commit_id)?)?;
        self.checkout_commit_tree(note_id, &commit)
    }

    fn checkout_commit_tree(&self, note_id: &str, commit: &git2::Commit<'_>) -> Result<String, git2::Error> {
        let tree = commit.tree()?;
        let path_string = format!("notes/{}.md", note_id);
        let path = Path::new(&path_string);
        let entry = tree.get_path(path)?;
        let blob = self.repo.find_blob(entry.id())?;
        Ok(String::from_utf8_lossy(blob.content()).to_string())
    }
}
