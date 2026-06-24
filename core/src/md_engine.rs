//! NoteForge Core — Markdown 引擎
//!
//! 负责 Markdown 解析、AST 构建、HTML 渲染、Wiki Link 和标签提取。

use pulldown_cmark::{Parser, Event, Tag, HeadingLevel, Options};
use crate::types;

/// 解析后的链接引用
#[derive(Debug, Clone)]
pub struct LinkRef {
    pub target: String,  // [[目标]]
    pub context: String, // 链接上下文文本
}

/// 解析后的标签引用
#[derive(Debug, Clone)]
pub struct TagRef {
    pub name: String,
}

/// Markdown 引擎
pub struct MarkdownEngine;

impl MarkdownEngine {
    /// 将 Markdown 渲染为 HTML
    pub fn render_html(markdown: &str) -> String {
        let mut options = Options::empty();
        options.insert(Options::ENABLE_TABLES);
        options.insert(Options::ENABLE_FOOTNOTES);
        options.insert(Options::ENABLE_STRIKETHROUGH);
        options.insert(Options::ENABLE_TASKLISTS);
        options.insert(Options::ENABLE_HEADING_ATTRIBUTES);

        let parser = Parser::new_ext(markdown, options);
        let mut html = String::new();
        pulldown_cmark::html::push_html(&mut html, parser);
        html
    }

    /// 提取纯文本（去除 Markdown 标记，用于搜索索引）
    pub fn extract_plain_text(markdown: &str) -> String {
        let parser = Parser::new(markdown);
        let mut plain = String::new();
        let mut in_code_block = false;

        for event in parser {
            match event {
                Event::Text(t) | Event::Code(t) => {
                    if !in_code_block {
                        plain.push_str(&t);
                        plain.push(' ');
                    }
                }
                Event::Start(Tag::CodeBlock(_)) => in_code_block = true,
                Event::End(Tag::CodeBlock(_)) => in_code_block = false,
                Event::SoftBreak | Event::HardBreak => plain.push(' '),
                _ => {}
            }
        }

        plain.trim().to_string()
    }

    /// 提取 [[Wiki Link]]
    pub fn extract_wiki_links(markdown: &str) -> Vec<String> {
        let mut links = Vec::new();
        // 匹配 [[目标]] 或 [[目标|显示文本]]
        let re = regex_lite::Regex::new(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]").unwrap();
        for cap in re.captures_iter(markdown) {
            let target = cap.get(1).map(|m| m.as_str().trim()).unwrap_or("");
            if !target.is_empty() && !links.contains(&target.to_string()) {
                links.push(target.to_string());
            }
        }
        links
    }

    /// 提取 #标签
    pub fn extract_tags(markdown: &str) -> Vec<String> {
        let mut tags = Vec::new();
        // 匹配 #标签（英文字母开头，可含中文/数字/下划线）
        let re = regex_lite::Regex::new(r"(?<!\w)#([\w\u{4e00}-\u{9fff}\-]+)").unwrap();
        for cap in re.captures_iter(markdown) {
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
            if ch.is_alphanumeric() || ch.is_ascii_punctuation() {
                if !in_word {
                    count += 1;
                    in_word = true;
                }
            } else if ch.is_whitespace() {
                in_word = false;
            } else {
                // 中文字符按字符数
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
    fn test_render_html() {
        let html = MarkdownEngine::render_html("# Hello\nWorld");
        assert!(html.contains("<h1>Hello</h1>"));
        assert!(html.contains("<p>World</p>"));
    }

    #[test]
    fn test_extract_wiki_links() {
        let links = MarkdownEngine::extract_wiki_links(
            "参考 [[架构设计]] 和 [[性能优化|优化方案]]"
        );
        assert!(links.contains(&"架构设计".to_string()));
        assert!(links.contains(&"性能优化".to_string()));
    }

    #[test]
    fn test_extract_tags() {
        let tags = MarkdownEngine::extract_tags(
            "今日学习 #Rust #NoteForge 和 #笔记"
        );
        assert!(tags.contains(&"Rust".to_string()));
        assert!(tags.contains(&"NoteForge".to_string()));
        assert!(tags.contains(&"笔记".to_string()));
    }

    #[test]
    fn test_count_words() {
        let c = MarkdownEngine::count_words("Hello World");
        assert_eq!(c, 2);

        let c = MarkdownEngine::count_words("你好世界");
        assert!(c >= 4);
    }
}
