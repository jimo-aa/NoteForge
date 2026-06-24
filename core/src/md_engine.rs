//! NoteForge Core — Markdown 引擎
//!
//! 负责 Markdown 解析、AST 构建、HTML 渲染、Wiki Link 和标签提取。

use pulldown_cmark::{html, Event, HeadingLevel, Options, Parser, Tag};
use serde::{Deserialize, Serialize};

/// Markdown AST 节点
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AstNode {
    Document { children: Vec<AstNode> },
    Paragraph { children: Vec<AstNode> },
    Heading { level: u32, children: Vec<AstNode> },
    Text { value: String },
    Code { value: String },
    WikiLink { target: String, label: Option<String> },
    Tag { value: String },
}

/// 解析后的链接引用
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LinkRef {
    pub target: String,
    pub label: Option<String>,
    pub context: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HtmlRenderOptions {
    pub wiki_link_prefix: String,
}

impl Default for HtmlRenderOptions {
    fn default() -> Self {
        Self {
            wiki_link_prefix: "noteforge://note/".to_string(),
        }
    }
}

/// Markdown 引擎
pub struct MarkdownEngine;

impl MarkdownEngine {
    fn options() -> Options {
        let mut options = Options::empty();
        options.insert(Options::ENABLE_TABLES);
        options.insert(Options::ENABLE_FOOTNOTES);
        options.insert(Options::ENABLE_STRIKETHROUGH);
        options.insert(Options::ENABLE_TASKLISTS);
        options.insert(Options::ENABLE_HEADING_ATTRIBUTES);
        options
    }

    fn wiki_link_regex() -> regex_lite::Regex {
        regex_lite::Regex::new(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]").unwrap()
    }

    fn tag_regex() -> regex_lite::Regex {
        regex_lite::Regex::new(r"(?:^|\s)#([\w\u{4e00}-\u{9fff}\-]+)").unwrap()
    }

    fn heading_level_to_u32(level: HeadingLevel) -> u32 {
        match level {
            HeadingLevel::H1 => 1,
            HeadingLevel::H2 => 2,
            HeadingLevel::H3 => 3,
            HeadingLevel::H4 => 4,
            HeadingLevel::H5 => 5,
            HeadingLevel::H6 => 6,
        }
    }

    /// 解析 Markdown 为 AST
    pub fn parse(markdown: &str) -> AstNode {
        let mut children = Vec::new();
        let mut stack: Vec<(AstNode, Vec<AstNode>)> = Vec::new();
        let parser = Parser::new_ext(markdown, Self::options());

        for event in parser {
            match event {
                Event::Start(tag) => {
                    let node = match tag {
                        Tag::Paragraph => Some(AstNode::Paragraph { children: vec![] }),
                        Tag::Heading { level, .. } => Some(AstNode::Heading { level: Self::heading_level_to_u32(level), children: vec![] }),
                        _ => None,
                    };
                    if let Some(node) = node { stack.push((node, Vec::new())); }
                }
                Event::End(tag_end) => {
                    if let Some((node, node_children)) = stack.pop() {
                        let finalized = match node {
                            AstNode::Paragraph { .. } => AstNode::Paragraph { children: node_children },
                            AstNode::Heading { level, .. } => AstNode::Heading { level, children: node_children },
                            _ => continue,
                        };
                        if let Some((_, parent_children)) = stack.last_mut() {
                            parent_children.push(finalized);
                        } else {
                            children.push(finalized);
                        }
                    }
                    let _ = tag_end;
                }
                Event::Text(text) => Self::push_text_nodes(text.as_ref(), &mut stack, &mut children),
                Event::Code(code) => Self::push_node(AstNode::Code { value: code.to_string() }, &mut stack, &mut children),
                Event::SoftBreak | Event::HardBreak => Self::push_node(AstNode::Text { value: "\n".into() }, &mut stack, &mut children),
                _ => {}
            }
        }

        AstNode::Document { children }
    }

    fn push_node(node: AstNode, stack: &mut Vec<(AstNode, Vec<AstNode>)>, root: &mut Vec<AstNode>) {
        if let Some((_, children)) = stack.last_mut() {
            children.push(node);
        } else {
            root.push(node);
        }
    }

    fn push_text_nodes(text: &str, stack: &mut Vec<(AstNode, Vec<AstNode>)>, root: &mut Vec<AstNode>) {
        let wiki_re = Self::wiki_link_regex();
        let mut last = 0;
        for cap in wiki_re.captures_iter(text) {
            let m = cap.get(0).unwrap();
            let before = &text[last..m.start()];
            if !before.is_empty() {
                Self::push_node(AstNode::Text { value: before.to_string() }, stack, root);
            }
            let target = cap.get(1).map(|m| m.as_str().trim()).unwrap_or("");
            let label = cap.get(2).map(|m| m.as_str().trim().to_string());
            if !target.is_empty() {
                Self::push_node(AstNode::WikiLink { target: target.to_string(), label }, stack, root);
            }
            last = m.end();
        }
        let rest = &text[last..];
        if !rest.is_empty() {
            Self::push_node(AstNode::Text { value: rest.to_string() }, stack, root);
        }
    }

    /// 将 Markdown 渲染为 HTML
    pub fn render_html(markdown: &str) -> String {
        let mut html_out = String::new();
        let parser = Parser::new_ext(markdown, Self::options());
        html::push_html(&mut html_out, parser);
        let rendered = Self::render_wiki_links(&html_out);
        Self::render_tags(&rendered)
    }

    fn render_wiki_links(html: &str) -> String {
        Self::wiki_link_regex().replace_all(html, |caps: &regex_lite::Captures| {
            let target = caps.get(1).map(|m| m.as_str().trim()).unwrap_or("");
            let label = caps.get(2).map(|m| m.as_str().trim()).unwrap_or(target);
            format!(r#"<a href="noteforge://note/{target}" data-wiki-link="true">{}</a>"#, htmlescape::encode_minimal(label))
        }).to_string()
    }

    fn render_tags(html: &str) -> String {
        Self::tag_regex().replace_all(html, |caps: &regex_lite::Captures| {
            let tag = caps.get(1).map(|m| m.as_str()).unwrap_or("");
            let full = caps.get(0).map(|m| m.as_str()).unwrap_or("");
            let prefix_len = full.len().saturating_sub(tag.len() + 1);
            let prefix = &full[..prefix_len];
            format!(r#"{}<span class="noteforge-tag">#{}</span>"#, htmlescape::encode_minimal(prefix), htmlescape::encode_minimal(tag))
        }).to_string()
    }

    /// 提取纯文本（去除 Markdown 标记，用于搜索索引）
    pub fn extract_plain_text(markdown: &str) -> String {
        let ast = Self::parse(markdown);
        let mut out = String::new();
        Self::collect_text(&ast, &mut out);
        out.split_whitespace().collect::<Vec<_>>().join(" ")
    }

    fn collect_text(node: &AstNode, out: &mut String) {
        match node {
            AstNode::Document { children } | AstNode::Paragraph { children } | AstNode::Heading { children, .. } => {
                for child in children { Self::collect_text(child, out); }
            }
            AstNode::Text { value } | AstNode::Code { value } => {
                out.push_str(value);
                out.push(' ');
            }
            AstNode::WikiLink { target, label } => {
                out.push_str(label.as_deref().unwrap_or(target));
                out.push(' ');
            }
            AstNode::Tag { value } => {
                out.push_str(value);
                out.push(' ');
            }
        }
    }

    /// 提取 [[Wiki Link]]
    pub fn extract_wiki_links(markdown: &str) -> Vec<String> {
        Self::wiki_link_regex()
            .captures_iter(markdown)
            .filter_map(|cap| cap.get(1).map(|m| m.as_str().trim().to_string()))
            .filter(|s| !s.is_empty())
            .collect()
    }

    /// 提取 #标签
    pub fn extract_tags(markdown: &str) -> Vec<String> {
        let mut tags = Vec::new();
        for cap in Self::tag_regex().captures_iter(markdown) {
            let tag = cap.get(1).map(|m| m.as_str()).unwrap_or("");
            if !tag.is_empty() && !tags.contains(&tag.to_string()) {
                tags.push(tag.to_string());
            }
        }
        tags
    }

    /// 统计字数（中文按字符，英文按单词）
    pub fn count_words(text: &str) -> u32 {
        let plain = Self::extract_plain_text(text);
        let mut count = 0u32;
        let mut in_word = false;

        for ch in plain.chars() {
            if ch.is_ascii_alphanumeric() {
                if !in_word { count += 1; in_word = true; }
            } else if ch.is_whitespace() {
                in_word = false;
            } else {
                count += 1;
                in_word = false;
            }
        }
        count.max(1)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_ast() {
        let ast = MarkdownEngine::parse("# Hello\n\n参考 [[架构设计]]");
        match ast {
            AstNode::Document { children } => assert!(!children.is_empty()),
            _ => panic!("expected document"),
        }
    }

    #[test]
    fn test_render_html() {
        let html = MarkdownEngine::render_html("# Hello\nWorld\n\n参考 [[架构设计]]");
        assert!(html.contains("<h1>Hello</h1>"));
        assert!(html.contains("noteforge://note/架构设计"));
    }

    #[test]
    fn test_extract_wiki_links() {
        let links = MarkdownEngine::extract_wiki_links("参考 [[架构设计]] 和 [[性能优化|优化方案]]");
        assert!(links.contains(&"架构设计".to_string()));
        assert!(links.contains(&"性能优化".to_string()));
    }
}
