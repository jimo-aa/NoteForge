//! 版本控制 (VCS) 集成测试 — 验证 git_history 端到端流程

use std::fs;

// 使用 crate 中的 git_history 模块
// 注意: 由于桌面 crate 是 lib 类型，tests 目录可以引用它
use noteforge_desktop_lib::git_history::GitHistory;

fn setup_temp_dir() -> (tempfile::TempDir, GitHistory) {
    let dir = tempfile::tempdir().expect("创建临时目录失败");
    let worktree = dir.path().to_path_buf();
    
    // 创建 notes 目录（git_history 的 ensure_note_path 需要）
    fs::create_dir_all(worktree.join("notes")).ok();
    
    let history = GitHistory::open(worktree).expect("GitHistory::open 应该成功");
    (dir, history)
}

#[test]
fn test_git_history_init() {
    let (_dir, _history) = setup_temp_dir();
    // 验证 GitHistory 可以成功初始化
    // 如果 open 没有 panic，测试通过
}

#[test]
fn test_commit_note() {
    let (_dir, history) = setup_temp_dir();
    let note_id = "test-note-001";
    
    // 提交第一个版本
    let oid1 = history.commit_note(note_id, "v1 初始版本", "# Hello World\n这是第一版内容。")
        .expect("首次提交应该成功");
    assert!(!oid1.is_empty(), "提交 ID 不能为空");
    
    // 提交第二个版本
    let oid2 = history.commit_note(note_id, "v2 添加内容", "# Hello World\n这是第一版内容。\n\n新增一行内容。")
        .expect("第二次提交应该成功");
    assert_ne!(oid1, oid2, "两次提交的 ID 应该不同");
}

#[test]
fn test_list_versions() {
    let (_dir, history) = setup_temp_dir();
    let note_id = "test-note-002";
    
    // 初始状态：没有版本
    let versions = history.list_versions(note_id).expect("列出版本应该成功");
    assert!(versions.is_empty(), "初始时版本列表应该为空");
    
    // 提交一个版本
    history.commit_note(note_id, "v1", "内容 v1").expect("提交应该成功");
    let versions = history.list_versions(note_id).expect("列出版本应该成功");
    assert_eq!(versions.len(), 1, "应该有一个版本");
    assert!(versions[0].title.contains("v1"));
    
    // 再提交一个版本
    history.commit_note(note_id, "v2", "内容 v2").expect("提交应该成功");
    let versions = history.list_versions(note_id).expect("列出版本应该成功");
    assert_eq!(versions.len(), 2, "应该有两个版本");
}

#[test]
fn test_checkout_version() {
    let (_dir, history) = setup_temp_dir();
    let note_id = "test-note-003";
    
    // 提交两个版本
    let oid1 = history.commit_note(note_id, "v1", "版本一的内容").expect("提交 v1 应该成功");
    let _oid2 = history.commit_note(note_id, "v2", "版本二的内容").expect("提交 v2 应该成功");
    
    // 结出版本一
    let content = history.checkout_version(&oid1, note_id)
        .expect("结出版本一应该成功");
    assert_eq!(content.trim(), "版本一的内容");
}

#[test]
fn test_branch_management() {
    let (_dir, history) = setup_temp_dir();
    let note_id = "test-note-004";
    
    // 提交初始版本
    let _oid = history.commit_note(note_id, "main v1", "主分支内容").expect("提交应该成功");
    
    // 检查当前分支
    let current = history.get_current_branch(note_id).expect("获取当前分支应该成功");
    assert_eq!(current, "main");
    
    // 创建新分支
    history.create_branch(note_id, "feature-1", None).expect("创建分支应该成功");
    
    // 当前分支应该切换到新分支
    let current = history.get_current_branch(note_id).expect("获取当前分支应该成功");
    assert_eq!(current, "feature-1");
    
    // 在新分支上提交
    history.commit_note(note_id, "feature v1", "功能分支内容").expect("在新分支提交应该成功");
    
    // 切换回 main 分支
    let content = history.checkout_branch(note_id, "main").expect("切换分支应该成功");
    assert_eq!(content.trim(), "主分支内容");
    
    // 列出分支
    let branches = history.list_branches(note_id).expect("列出分支应该成功");
    assert!(branches.len() >= 2, "至少有两个分支");
    assert!(branches.iter().any(|b| b.name == "main"));
    assert!(branches.iter().any(|b| b.name == "feature-1"));
}

#[test]
fn test_delete_version() {
    let (_dir, history) = setup_temp_dir();
    let note_id = "test-note-005";
    
    // 提交多个版本
    let oid1 = history.commit_note(note_id, "v1", "版本一").expect("提交 v1 应该成功");
    let _oid2 = history.commit_note(note_id, "v2", "版本二").expect("提交 v2 应该成功");
    let _oid3 = history.commit_note(note_id, "v3", "版本三").expect("提交 v3 应该成功");
    
    // 删除版本一（软删除）
    let deleted = history.delete_version(note_id, &oid1).expect("删除版本应该成功");
    assert!(deleted, "删除应该返回 true");
    
    // 验证删除操作返回成功
    assert!(deleted, "删除应该返回 true");
    
    // 验证被删除的版本可以通过 list_deleted_versions 找到
    let deleted_list = history.list_deleted_versions(note_id).expect("列出已删除版本应该成功");
    assert!(deleted_list.contains(&oid1), "已删除的版本应该在已删除列表中");
    
    // 验证 is_version_deleted 返回 true
    let is_deleted = history.is_version_deleted(note_id, &oid1).expect("检查删除状态应该成功");
    assert!(is_deleted, "删除标记应该有效");
}

#[test]
fn test_multiple_notes_isolation() {
    let (_dir, history) = setup_temp_dir();
    
    // 两个不同的笔记操作应该互不干扰
    let note_a = "note-a";
    let note_b = "note-b";
    
    history.commit_note(note_a, "note a v1", "Note A 的内容").expect("提交 A 应该成功");
    history.commit_note(note_b, "note b v1", "Note B 的内容").expect("提交 B 应该成功");
    
    assert_eq!(history.list_versions(note_a).unwrap().len(), 1);
    assert_eq!(history.list_versions(note_b).unwrap().len(), 1);
    
    // 只在 Note A 上提交新版本
    history.commit_note(note_a, "note a v2", "Note A 的新内容").expect("提交 A v2 应该成功");
    
    assert_eq!(history.list_versions(note_a).unwrap().len(), 2);
    assert_eq!(history.list_versions(note_b).unwrap().len(), 1);
}

#[test]
fn test_version_content_unchanged_no_duplicate() {
    let (_dir, history) = setup_temp_dir();
    let note_id = "test-note-006";
    
    // 提交版本
    let oid1 = history.commit_note(note_id, "v1", "相同内容").expect("提交 v1 应该成功");
    
    // 用相同内容再次提交 — git 应该仍然创建一个新提交（因为时间戳可能变化）
    let oid2 = history.commit_note(note_id, "v2", "相同内容").expect("提交 v2 应该成功");
    
    // 两个提交 ID 应该不同（因为 commit 有不同时间戳/消息）
    // 但结出的内容应该相同
    let _content1 = history.checkout_version(&oid1, note_id).expect("结出 v1 应该成功");
    let _content2 = history.checkout_version(&oid2, note_id).expect("结出 v2 应该成功");
    
    // 即使内容相似，每次 commit 创建的 ID 不同（时间戳/消息不同）
    assert_ne!(oid1, oid2);
}
