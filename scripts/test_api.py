#!/usr/bin/env python3
"""
NoteForge — Backend API 自动化测试脚本
测试所有后端接口，覆盖 Auth / Notes / Notebooks / Tags / Search / Versions / Export / Sync / AI / Attachments

用法:
    python scripts/test_api.py                          # 默认 Gateway http://localhost:8000
    python scripts/test_api.py --gateway http://localhost:8000
    python scripts/test_api.py --verbose                # 显示请求/响应详情
    python scripts/test_api.py --skip-ai                # 跳过 AI 测试（需 API Key）
"""

import sys

# Windows console UTF-8 support
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import argparse
import json
import sys
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional
from urllib.parse import urljoin

try:
    import requests
except ImportError:
    print("ERROR: Please install requests: pip install requests")
    sys.exit(1)


# ═══════════════════════════════════════════════════════════════
#  配置
# ═══════════════════════════════════════════════════════════════

GATEWAY_URL = "http://localhost:8000"

# 测试用户
TEST_USER = {
    "name": "testuser",
    "email": f"test_{int(time.time())}@noteforge.test",
    "password": "TestPass123!",
}


# ═══════════════════════════════════════════════════════════════
#  工具
# ═══════════════════════════════════════════════════════════════

@dataclass
class TestContext:
    """跨测试共享状态"""
    access_token: str = ""
    refresh_token: str = ""
    user_id: str = ""
    note_id: str = ""
    note_id_2: str = ""
    notebook_id: str = ""
    tag_id: str = ""
    version_number: int = 0
    attachment_id: str = ""
    last_version: int = 0


ctx = TestContext()
verbose = False
passed = 0
failed = 0
skipped = 0
results: list[dict] = []


def log(msg: str, end="\n"):
    print(msg, end=end, flush=True)


def api_url(path: str) -> str:
    return urljoin(GATEWAY_URL.rstrip("/") + "/", path.lstrip("/"))


def headers() -> dict:
    h = {"Content-Type": "application/json"}
    if ctx.access_token:
        h["Authorization"] = f"Bearer {ctx.access_token}"
    return h


def request(method: str, path: str, **kwargs) -> requests.Response:
    url = api_url(path)
    if "headers" not in kwargs:
        kwargs["headers"] = headers()
    if verbose:
        print(f"\n  >>> {method.upper()} {url}")
        if "json" in kwargs:
            print(f"      Body: {json.dumps(kwargs['json'], ensure_ascii=False)[:200]}")
    resp = requests.request(method, url, timeout=30, **kwargs)
    if verbose:
        print(f"      <<< {resp.status_code} {resp.text[:300]}")
    return resp


def assert_ok(resp: requests.Response, label: str) -> dict:
    global passed, failed
    try:
        body = resp.json()
        assert resp.status_code in (200, 201), f"HTTP {resp.status_code}"
        assert body.get("code") == 0, f"code={body.get('code')}, msg={body.get('message')}"
        passed += 1
        results.append({"test": label, "status": "PASS"})
        return body.get("data") or body
    except (AssertionError, json.JSONDecodeError, KeyError) as e:
        failed += 1
        results.append({"test": label, "status": "FAIL", "error": str(e), "response": resp.text[:200]})
        log(f"\n  ❌ {label}: {e}")
        if verbose:
            log(f"     Response: {resp.text[:300]}")
        return {}


def assert_status(resp: requests.Response, expected: int, label: str) -> bool:
    global passed, failed
    if resp.status_code == expected:
        passed += 1
        results.append({"test": label, "status": "PASS"})
        return True
    failed += 1
    results.append({"test": label, "status": "FAIL", "error": f"Expected {expected}, got {resp.status_code}"})
    log(f"\n  ❌ {label}: 期望 {expected}, 实际 {resp.status_code}")
    return False


def section(title: str):
    log(f"\n{'='*60}")
    log(f"  {title}")
    log(f"{'='*60}")


def subtask(title: str):
    log(f"\n  ▸ {title}", end=" ")


# ═══════════════════════════════════════════════════════════════
#  测试: Auth
# ═══════════════════════════════════════════════════════════════

def test_register():
    subtask("注册新用户")
    resp = request("POST", "/api/v1/auth/register", json={
        "name": TEST_USER["name"],
        "email": TEST_USER["email"],
        "password": TEST_USER["password"],
    })
    data = assert_ok(resp, "Auth: Register")
    if data:
        ctx.access_token = data.get("accessToken", "")
        ctx.refresh_token = data.get("refreshToken", "")
        ctx.user_id = data.get("user", {}).get("id", "")
        log("✅")


def test_login():
    subtask("登录")
    resp = request("POST", "/api/v1/auth/login", json={
        "email": TEST_USER["email"],
        "password": TEST_USER["password"],
    })
    data = assert_ok(resp, "Auth: Login")
    if data:
        ctx.access_token = data.get("accessToken", "")
        ctx.refresh_token = data.get("refreshToken", "")
        ctx.user_id = data.get("user", {}).get("id", "")
        log("✅")


def test_auth_me():
    subtask("获取当前用户")
    resp = request("GET", "/api/v1/auth/me")
    data = assert_ok(resp, "Auth: Get Me")
    if data:
        assert data.get("email") == TEST_USER["email"], "Email mismatch"
        log(f"✅ ({data.get('name', '')})")


def test_refresh_token():
    subtask("刷新 Token")
    resp = request("POST", "/api/v1/auth/refresh", json={
        "refreshToken": ctx.refresh_token,
    })
    data = assert_ok(resp, "Auth: Refresh Token")
    if data:
        ctx.access_token = data.get("accessToken", "")
        ctx.refresh_token = data.get("refreshToken", "")
        log("✅")


def test_logout():
    subtask("登出")
    resp = request("POST", "/api/v1/auth/logout", json={
        "refreshToken": ctx.refresh_token,
    })
    assert_ok(resp, "Auth: Logout")
    log("✅")


# ═══════════════════════════════════════════════════════════════
#  测试: Notebooks
# ═══════════════════════════════════════════════════════════════

def test_create_notebook():
    subtask("创建笔记本")
    resp = request("POST", "/api/v1/notebooks", params={
        "name": "测试笔记本",
        "icon": "📓",
        "color": "#6366f1",
    })
    data = assert_ok(resp, "Notebook: Create")
    if data:
        ctx.notebook_id = data.get("id", "")
        log(f"✅ ({data.get('name')})")


def test_list_notebooks():
    subtask("列出笔记本")
    resp = request("GET", "/api/v1/notebooks")
    data = assert_ok(resp, "Notebook: List")
    if data:
        assert any(n.get("id") == ctx.notebook_id for n in data), "Notebook not in list"
        log(f"✅ ({len(data)} 个)")


def test_rename_notebook():
    subtask("重命名笔记本")
    resp = request("PUT", f"/api/v1/notebooks/{ctx.notebook_id}", params={"name": "测试笔记本 (已重命名)"})
    assert_ok(resp, "Notebook: Rename")
    log("✅")


def test_reorder_notebooks():
    subtask("笔记本排序")
    resp = request("PUT", "/api/v1/notebooks/reorder", json=[ctx.notebook_id])
    assert_ok(resp, "Notebook: Reorder")
    log("✅")


# ═══════════════════════════════════════════════════════════════
#  测试: Notes
# ═══════════════════════════════════════════════════════════════

def test_create_note():
    subtask("创建笔记")
    resp = request("POST", "/api/v1/notes", json={
        "title": "测试笔记标题",
        "content": "# 测试笔记\n\n这是一条测试笔记内容，用于 API 测试。\n\n- 列表项 1\n- 列表项 2\n\n**粗体文字**",
        "notebookId": ctx.notebook_id,
        "tags": ["测试", "API"],
    })
    data = assert_ok(resp, "Note: Create")
    if data:
        ctx.note_id = data.get("id", "")
        log(f"✅ ({data.get('title')})")


def test_create_note_no_notebook():
    subtask("创建笔记 (无笔记本)")
    resp = request("POST", "/api/v1/notes", json={
        "title": "无分类笔记",
        "content": "这是一条没有笔记本的笔记。",
    })
    data = assert_ok(resp, "Note: Create (no notebook)")
    if data:
        ctx.note_id_2 = data.get("id", "")
        assert data.get("notebookId") is None or data.get("notebookId") == ""
        log("✅")


def test_get_note():
    subtask("获取笔记详情")
    resp = request("GET", f"/api/v1/notes/{ctx.note_id}")
    data = assert_ok(resp, "Note: Get")
    if data:
        assert data.get("title") == "测试笔记标题"
        log("✅")


def test_update_note():
    subtask("更新笔记")
    resp = request("PUT", f"/api/v1/notes/{ctx.note_id}", json={
        "title": "测试笔记标题 (已更新)",
        "content": "更新后的内容。",
        "isPinned": True,
        "isFavorite": True,
    })
    data = assert_ok(resp, "Note: Update")
    if data:
        # Jackson serializes boolean isPinned as "pinned", not "isPinned"
        is_pinned = data.get("pinned") if "pinned" in data else data.get("isPinned")
        is_fav = data.get("favorite") if "favorite" in data else data.get("isFavorite")
        assert is_pinned is True, f"Expected pinned=true, got pinned={is_pinned}, data keys={list(data.keys())}"
        assert is_fav is True, f"Expected favorite=true, got favorite={is_fav}"
        log("✅")


def test_list_notes():
    subtask("列出笔记")
    resp = request("GET", "/api/v1/notes")
    data = assert_ok(resp, "Note: List")
    if data:
        items = data.get("items") or data.get("content") or data
        log(f"✅ ({len(items)} 条)")


def test_list_notes_filtered():
    subtask("按笔记本筛选笔记")
    resp = request("GET", "/api/v1/notes", params={"notebookId": ctx.notebook_id})
    data = assert_ok(resp, "Note: List (by notebook)")
    log("✅")


def test_list_notes_pinned():
    subtask("按置顶筛选笔记")
    resp = request("GET", "/api/v1/notes", params={"isPinned": "true"})
    assert_ok(resp, "Note: List (pinned)")
    log("✅")


def test_list_notes_favorite():
    subtask("按收藏筛选笔记")
    resp = request("GET", "/api/v1/notes", params={"isFavorite": "true"})
    assert_ok(resp, "Note: List (favorite)")
    log("✅")


# ═══════════════════════════════════════════════════════════════
#  测试: Tags
# ═══════════════════════════════════════════════════════════════

def test_create_tag():
    subtask("创建标签")
    resp = request("POST", "/api/v1/tags", params={
        "name": f"tag-api-test-{int(time.time())}",
        "color": "#ff6b6b",
    })
    data = assert_ok(resp, "Tag: Create")
    if data:
        ctx.tag_id = data.get("id", "")
        log("✅")


def test_list_tags():
    subtask("列出标签")
    resp = request("GET", "/api/v1/tags")
    data = assert_ok(resp, "Tag: List")
    if data:
        log(f"✅ ({len(data)} 个)")


# ═══════════════════════════════════════════════════════════════
#  测试: Search
# ═══════════════════════════════════════════════════════════════

def test_search_fulltext():
    subtask("全文搜索")
    resp = request("GET", "/api/v1/search", params={"q": "测试笔记", "mode": "fulltext"})
    data = assert_ok(resp, "Search: Fulltext")
    if data:
        items = data.get("items") or data.get("content") or []
        log(f"✅ ({len(items)} 条结果)")


def test_search_fuzzy():
    subtask("模糊搜索")
    resp = request("GET", "/api/v1/search/fuzzy", params={"q": "测式备忘", "page": "0", "size": "10"})
    data = assert_ok(resp, "Search: Fuzzy")
    if data:
        items = data.get("items") or data.get("content") or []
        log(f"✅ ({len(items)} 条结果)")


# ═══════════════════════════════════════════════════════════════
#  测试: Versions + Diff
# ═══════════════════════════════════════════════════════════════

def test_create_version():
    subtask("创建版本快照")
    resp = request("POST", f"/api/v1/notes/{ctx.note_id}/versions", json={
        "title": "v1 快照",
        "content": "第一版内容。",
        "contentPlain": "第一版内容。",
    })
    data = assert_ok(resp, "Version: Create")
    if data:
        ctx.version_number = data.get("versionNumber", 1)
        log(f"✅ (v{ctx.version_number})")


def test_list_versions():
    subtask("列出版本历史")
    resp = request("GET", f"/api/v1/notes/{ctx.note_id}/versions")
    data = assert_ok(resp, "Version: List")
    if data:
        assert len(data) >= 1
        log(f"✅ ({len(data)} 个版本)")


def test_get_version():
    subtask("获取特定版本")
    resp = request("GET", f"/api/v1/notes/{ctx.note_id}/versions/{ctx.version_number}")
    data = assert_ok(resp, "Version: Get")
    if data:
        assert data.get("versionNumber") == ctx.version_number
        log("✅")


def test_version_diff():
    subtask("版本 Diff 对比")
    # Create a second version with different content
    request("POST", f"/api/v1/notes/{ctx.note_id}/versions", json={
        "title": "v2 快照",
        "content": "第二版内容，有所修改。新增了一行内容。",
        "contentPlain": "第二版内容，有所修改。新增了一行内容。",
    })

    resp = request("GET", f"/api/v1/notes/{ctx.note_id}/versions/{ctx.version_number}/diff",
                   params={"target": str(ctx.version_number + 1)})
    data = assert_ok(resp, "Version: Diff")
    if data:
        assert "operations" in data
        assert "similarity" in data
        assert "changeSummary" in data
        log(f"✅ (相似度: {data.get('similarity', 'N/A'):.2f})")


# ═══════════════════════════════════════════════════════════════
#  测试: Export
# ═══════════════════════════════════════════════════════════════

def test_export_note_markdown():
    subtask("导出笔记 (Markdown)")
    # Verify note exists via direct API call (not cached)
    direct_headers = {"Authorization": f"Bearer {ctx.access_token}"}
    resp_direct = requests.get(api_url(f"/api/v1/notes/{ctx.note_id}"), headers=direct_headers, timeout=10)
    assert_ok(resp_direct, "Export: Pre-check note exists")

    url = api_url(f"/api/v1/notes/{ctx.note_id}/export")
    resp = requests.get(
        url,
        params={"format": "markdown"},
        headers=direct_headers,
        timeout=30,
    )

    if assert_status(resp, 200, "Export: Note Markdown"):
        ct = resp.headers.get("Content-Type", "")
        cd = resp.headers.get("Content-Disposition", "")
        assert "markdown" in ct or "text/plain" in ct, f"Unexpected Content-Type: {ct}, headers: {dict(resp.headers)}"
        assert "attachment" in cd or "filename" in cd, f"Unexpected Content-Disposition: {cd}"
        log("✅")


def test_export_note_html():
    subtask("导出笔记 (HTML)")
    resp = request("GET", f"/api/v1/notes/{ctx.note_id}/export", params={"format": "html"})
    if assert_status(resp, 200, "Export: Note HTML"):
        ct = resp.headers.get("Content-Type", "")
        assert "text/html" in ct, f"Unexpected Content-Type: {ct}"
        log("✅")


def test_export_note_json():
    subtask("导出笔记 (JSON)")
    resp = request("GET", f"/api/v1/notes/{ctx.note_id}/export", params={"format": "json"})
    if assert_status(resp, 200, "Export: Note JSON"):
        ct = resp.headers.get("Content-Type", "")
        assert "application/json" in ct, f"Unexpected Content-Type: {ct}"
        log("✅")


def test_export_notebook_markdown():
    subtask("导出笔记本 (Markdown)")
    resp = request("GET", f"/api/v1/notebooks/{ctx.notebook_id}/export", params={"format": "markdown"})
    if assert_status(resp, 200, "Export: Notebook Markdown"):
        ct = resp.headers.get("Content-Type", "")
        cd = resp.headers.get("Content-Disposition", "")
        assert "markdown" in ct or "text/plain" in ct, f"Unexpected Content-Type: {ct}"
        assert "filename" in cd, f"No filename in Content-Disposition: {cd}"
        log("✅")


def test_export_notebook_json():
    subtask("导出笔记本 (JSON)")
    resp = request("GET", f"/api/v1/notebooks/{ctx.notebook_id}/export", params={"format": "json"})
    if assert_status(resp, 200, "Export: Notebook JSON"):
        ct = resp.headers.get("Content-Type", "")
        cd = resp.headers.get("Content-Disposition", "")
        assert "application/json" in ct, f"Unexpected Content-Type: {ct}"
        assert "filename" in cd, f"No filename in Content-Disposition: {cd}"
        log("✅")


# ═══════════════════════════════════════════════════════════════
#  测试: Backlinks
# ═══════════════════════════════════════════════════════════════

def test_backlinks():
    subtask("获取笔记反向链接")
    resp = request("GET", f"/api/v1/notes/{ctx.note_id}/backlinks")
    assert_ok(resp, "Note: Backlinks")
    log("✅")


# ═══════════════════════════════════════════════════════════════
#  测试: Sync
# ═══════════════════════════════════════════════════════════════

def test_sync_state():
    subtask("获取同步状态")
    resp = request("GET", "/api/v1/sync/state")
    data = assert_ok(resp, "Sync: State")
    if data:
        ctx.last_version = data.get("lastVersion", 0)
        log(f"✅ (lastVersion={ctx.last_version})")


def test_sync_pull():
    subtask("同步拉取")
    resp = request("POST", "/api/v1/sync/pull", json={"lastVersion": 0})
    data = assert_ok(resp, "Sync: Pull")
    if data:
        notes = data.get("notes", [])
        log(f"✅ ({len(notes)} 条变更)")


def test_sync_push():
    subtask("同步推送")
    # Get current note version first (note was updated, version incremented)
    note_resp = request("GET", f"/api/v1/notes/{ctx.note_id}")
    note_data = assert_ok(note_resp, "Sync: Get note version pre-push")
    current_version = note_data.get("version", 1) if note_data else 1

    resp = request("POST", "/api/v1/sync/push", json={
        "changes": [{
            "noteId": ctx.note_id,
            "clientVersion": current_version,
            "title": "同步测试标题",
            "content": "通过同步推送的内容。",
        }],
    })
    data = assert_ok(resp, "Sync: Push")
    if data:
        assert data.get("accepted", 0) >= 1, \
            f"Sync push not accepted: accepted={data.get('accepted')}, conflicts={data.get('conflicts')}, version={current_version}"
        log(f"✅ (接受: {data.get('accepted', 0)})")


def test_sync_conflicts():
    subtask("查询同步冲突")
    resp = request("GET", "/api/v1/sync/conflicts", params={"clientVersion": str(ctx.last_version)})
    assert_ok(resp, "Sync: Conflicts")
    log("✅")


# ═══════════════════════════════════════════════════════════════
#  测试: Attachments
# ═══════════════════════════════════════════════════════════════

def test_upload_attachment():
    subtask("上传附件")
    files = {"file": ("test.txt", b"Hello NoteForge Attachment!", "text/plain")}
    resp = requests.post(
        api_url("/api/v1/attachments/upload"),
        headers={"Authorization": f"Bearer {ctx.access_token}"},
        files=files,
        params={"noteId": ctx.note_id},
        timeout=30,
    )
    data = assert_ok(resp, "Attachment: Upload")
    if data:
        ctx.attachment_id = data.get("id", "")
        log(f"✅ ({data.get('filename', '')})")


def test_list_attachments():
    subtask("列出附件")
    resp = request("GET", "/api/v1/attachments", params={"noteId": ctx.note_id})
    data = assert_ok(resp, "Attachment: List")
    if data:
        assert any(a.get("id") == ctx.attachment_id for a in data), "Attachment not in list"
        log(f"✅ ({len(data)} 个)")


def test_get_attachment():
    subtask("获取附件详情")
    resp = request("GET", f"/api/v1/attachments/{ctx.attachment_id}")
    assert_ok(resp, "Attachment: Get")
    log("✅")


def test_download_attachment():
    subtask("下载附件")
    resp = requests.get(
        api_url(f"/api/v1/attachments/{ctx.attachment_id}/download"),
        headers={"Authorization": f"Bearer {ctx.access_token}"},
        timeout=30,
    )
    assert_status(resp, 200, "Attachment: Download")
    log("✅")


# ═══════════════════════════════════════════════════════════════
#  测试: AI
# ═══════════════════════════════════════════════════════════════

def test_ai_health():
    subtask("AI 服务健康检查")
    resp = request("GET", "/api/v1/ai/health")
    data = assert_ok(resp, "AI: Health")
    if data:
        assert data.get("status") == "UP"
        log(f"✅ (provider: {data.get('provider', 'N/A')})")


def test_ai_tag():
    subtask("AI 标签推荐")
    resp = request("POST", "/api/v1/ai/tag", json={
        "title": "Python 机器学习入门指南",
        "content": "本文介绍如何使用 Python 进行机器学习，包括数据预处理、模型训练和评估。",
    })
    data = assert_ok(resp, "AI: Tag")
    if data:
        tags = data.get("tags", [])
        log(f"✅ ({', '.join(tags)})")


def test_ai_embed():
    subtask("AI Embedding")
    resp = request("POST", "/api/v1/ai/embed", json={
        "text": "这是一条测试嵌入的文本。",
    })
    data = assert_ok(resp, "AI: Embed")
    if data:
        embedding = data.get("embedding", [])
        assert len(embedding) > 0, "Empty embedding"
        log(f"✅ (维度: {data.get('dimension', len(embedding))})")


# ═══════════════════════════════════════════════════════════════
#  清理
# ═══════════════════════════════════════════════════════════════

def test_delete_attachment():
    subtask("删除附件")
    resp = request("DELETE", f"/api/v1/attachments/{ctx.attachment_id}")
    assert_ok(resp, "Attachment: Delete")
    log("✅")


def test_delete_note():
    subtask("删除笔记")
    resp = request("DELETE", f"/api/v1/notes/{ctx.note_id}")
    assert_ok(resp, "Note: Delete")
    log("✅")


def test_delete_note_2():
    subtask("删除笔记 (无分类)")
    resp = request("DELETE", f"/api/v1/notes/{ctx.note_id_2}")
    assert_ok(resp, "Note: Delete (no notebook)")
    log("✅")


def test_delete_tag():
    subtask("删除标签")
    if ctx.tag_id:
        resp = request("DELETE", f"/api/v1/tags/{ctx.tag_id}")
        assert_ok(resp, "Tag: Delete")
        log("✅")


def test_delete_notebook():
    subtask("删除笔记本")
    resp = request("DELETE", f"/api/v1/notebooks/{ctx.notebook_id}")
    assert_ok(resp, "Notebook: Delete")
    log("✅")


# ═══════════════════════════════════════════════════════════════
#  Auth 异常场景
# ═══════════════════════════════════════════════════════════════

def test_auth_no_token():
    global passed, failed, results
    subtask("无 Token 请求被拒绝")
    resp = requests.get(api_url("/api/v1/notes"), timeout=30)
    # Gateway may return 401 (JwtAuth filter) or 403 (Spring Security fallback), both acceptable
    if resp.status_code in (401, 403):
        passed += 1
        results.append({"test": "Auth: No token", "status": "PASS"})
        log("✅")
    else:
        failed += 1
        results.append({"test": "Auth: No token", "status": "FAIL", "error": f"Expected 401/403, got {resp.status_code}"})
        log(f"\n  ❌ Auth: No token → {resp.status_code}")


def test_auth_invalid_token():
    global passed, failed, results
    subtask("无效 Token 被拒绝")
    resp = requests.get(
        api_url("/api/v1/notes"),
        headers={"Authorization": "Bearer invalid_token_here", "Content-Type": "application/json"},
        timeout=30,
    )
    if resp.status_code in (401, 403):
        passed += 1
        results.append({"test": "Auth: Invalid token", "status": "PASS"})
        log("✅")
    else:
        failed += 1
        results.append({"test": "Auth: Invalid token", "status": "FAIL", "error": f"Expected 401/403, got {resp.status_code}"})
        log(f"\n  ❌ Auth: Invalid token → {resp.status_code}")


# ═══════════════════════════════════════════════════════════════
#  主控
# ═══════════════════════════════════════════════════════════════

def run_suite(skip_ai: bool = False):
    global passed, failed, results
    passed = 0
    failed = 0
    results = []

    log(f"\n🚀 NoteForge API 测试套件")
    log(f"   Gateway: {GATEWAY_URL}")
    log(f"   测试用户: {TEST_USER['email']}")
    log(f"   详细模式: {'开启' if verbose else '关闭'}")
    log(f"   跳过 AI: {'是' if skip_ai else '否'}")
    log(f"   时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")

    # ── Auth ──
    section("1. 认证 (Auth)")
    test_register()
    test_auth_me()
    test_refresh_token()

    # ── Notebooks ──
    section("2. 笔记本 (Notebooks)")
    test_create_notebook()
    test_list_notebooks()
    test_rename_notebook()
    test_reorder_notebooks()

    # ── Notes ──
    section("3. 笔记 (Notes)")
    test_create_note()
    test_create_note_no_notebook()
    test_get_note()
    test_update_note()
    test_list_notes()
    test_list_notes_filtered()
    test_list_notes_pinned()
    test_list_notes_favorite()

    # ── Tags ──
    section("4. 标签 (Tags)")
    test_create_tag()
    test_list_tags()

    # ── Search ──
    section("5. 搜索 (Search)")
    test_search_fulltext()
    test_search_fuzzy()

    # ── Versions ──
    section("6. 版本控制 (Versions + Diff)")
    test_create_version()
    test_list_versions()
    test_get_version()
    test_version_diff()

    # ── Export ──
    section("7. 导出 (Export)")
    test_export_note_markdown()
    test_export_note_html()
    test_export_note_json()
    test_export_notebook_markdown()
    test_export_notebook_json()

    # ── Backlinks ──
    section("8. 反向链接 (Backlinks)")
    test_backlinks()

    # ── Sync ──
    section("9. 同步 (Sync)")
    test_sync_state()
    test_sync_pull()
    test_sync_push()
    test_sync_conflicts()

    # ── Attachments ──
    section("10. 附件 (Attachments)")
    test_upload_attachment()
    test_list_attachments()
    test_get_attachment()
    test_download_attachment()
    test_delete_attachment()

    # ── AI (可选) ──
    if not skip_ai:
        section("11. AI 服务")
        test_ai_health()
        test_ai_tag()
        test_ai_embed()
    else:
        global skipped
        skipped += 3

    # ── 清理 ──
    section("12. 清理 (Cleanup)")
    test_delete_note()
    test_delete_note_2()
    test_delete_tag()
    test_delete_notebook()

    # ── 异常场景 ──
    section("13. 异常场景 (Negative Tests)")
    test_auth_no_token()
    test_auth_invalid_token()

    # ── 登出 ──
    section("14. 登出 (Logout)")
    test_logout()

    # ── 报告 ──
    total = passed + failed
    log(f"\n{'='*60}")
    log(f"  📊 测试报告")
    log(f"{'='*60}")
    log(f"  总计: {total}")
    log(f"  ✅ 通过: {passed}")
    log(f"  ❌ 失败: {failed}")
    log(f"  ⏭️  跳过: {skipped}")
    log(f"  ✅ 成功率: {passed/total*100:.1f}%" if total > 0 else "  N/A")
    log(f"{'='*60}\n")

    # 失败详情
    if failed > 0:
        log("失败详情:")
        for r in results:
            if r["status"] == "FAIL":
                log(f"  ❌ {r['test']}: {r.get('error', '')}")
        log("")

    return failed == 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="NoteForge Backend API 自动化测试")
    parser.add_argument("--gateway", default=GATEWAY_URL, help=f"Gateway URL (default: {GATEWAY_URL})")
    parser.add_argument("--verbose", "-v", action="store_true", help="显示请求/响应详情")
    parser.add_argument("--skip-ai", action="store_true", help="跳过 AI 测试")
    args = parser.parse_args()

    GATEWAY_URL = args.gateway.rstrip("/")
    verbose = args.verbose

    success = run_suite(skip_ai=args.skip_ai)
    sys.exit(0 if success else 1)
