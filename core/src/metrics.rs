//! Usage metrics — local statistics tracking for NoteForge
//!
//! Collects lightweight usage data stored in SQLite:
//! - Launch count
//! - Notes created
//! - Edit session duration (seconds)
//! - Search count
//! - First / last launch timestamps

use serde::{Deserialize, Serialize};
use rusqlite::Connection;
use crate::error::CoreError;

/// Metrics data exposed to the frontend via Tauri
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetricsData {
    pub launch_count: i64,
    pub total_notes_created: i64,
    pub total_edit_seconds: i64,
    pub total_searches: i64,
    pub first_launch_at: i64,
    pub last_launch_at: i64,
}

impl MetricsData {
    fn empty() -> Self {
        Self {
            launch_count: 0,
            total_notes_created: 0,
            total_edit_seconds: 0,
            total_searches: 0,
            first_launch_at: 0,
            last_launch_at: 0,
        }
    }
}

/// Manages usage metrics via a shared SQLite connection.
pub struct MetricsManager {
    conn: Connection,
}

impl MetricsManager {
    /// Open (or create) the metrics table in the given SQLite connection.
    /// Uses a separate in-memory or file‑based connection so it does not
    /// interfere with the main storage schema.
    pub fn open(db_path: &std::path::Path) -> Result<Self, CoreError> {
        let conn = Connection::open(db_path)?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS metrics (
                key   TEXT PRIMARY KEY,
                value INTEGER NOT NULL DEFAULT 0
            );",
        )?;

        Ok(Self { conn })
    }

    /// Record that the app was launched.
    pub fn record_launch(&self) -> Result<(), CoreError> {
        let now = chrono_now_secs();
        self.increment("launch_count")?;
        self.set("last_launch_at", now)?;
        // Set first_launch_at only if not already set
        if self.get_raw("first_launch_at")? == 0 {
            self.set("first_launch_at", now)?;
        }
        Ok(())
    }

    /// Record that a note was created.
    pub fn record_note_created(&self) -> Result<(), CoreError> {
        self.increment("total_notes_created")
    }

    /// Record an edit session duration (in seconds).
    pub fn record_edit_session(&self, seconds: u64) -> Result<(), CoreError> {
        self.add("total_edit_seconds", seconds as i64)
    }

    /// Record that a search was performed.
    pub fn record_search(&self) -> Result<(), CoreError> {
        self.increment("total_searches")
    }

    /// Retrieve all metrics.
    pub fn get_metrics(&self) -> Result<MetricsData, CoreError> {
        let mut data = MetricsData::empty();
        let mut stmt = self.conn.prepare("SELECT key, value FROM metrics")?;
        let rows = stmt.query_map([], |row| {
            let key: String = row.get(0)?;
            let value: i64 = row.get(1)?;
            Ok((key, value))
        })?;

        for row in rows {
            let (key, value) = row?;
            match key.as_str() {
                "launch_count" => data.launch_count = value,
                "total_notes_created" => data.total_notes_created = value,
                "total_edit_seconds" => data.total_edit_seconds = value,
                "total_searches" => data.total_searches = value,
                "first_launch_at" => data.first_launch_at = value,
                "last_launch_at" => data.last_launch_at = value,
                _ => {}
            }
        }

        Ok(data)
    }

    // ── private helpers ──

    fn increment(&self, key: &str) -> Result<(), CoreError> {
        self.conn.execute(
            "INSERT INTO metrics (key, value) VALUES (?1, 1)
             ON CONFLICT(key) DO UPDATE SET value = value + 1",
            rusqlite::params![key],
        )?;
        Ok(())
    }

    fn add(&self, key: &str, amount: i64) -> Result<(), CoreError> {
        self.conn.execute(
            "INSERT INTO metrics (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = value + ?2",
            rusqlite::params![key, amount],
        )?;
        Ok(())
    }

    fn set(&self, key: &str, value: i64) -> Result<(), CoreError> {
        self.conn.execute(
            "INSERT INTO metrics (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = ?2",
            rusqlite::params![key, value],
        )?;
        Ok(())
    }

    fn get_raw(&self, key: &str) -> Result<i64, CoreError> {
        let result: Result<i64, _> = self.conn.query_row(
            "SELECT value FROM metrics WHERE key = ?1",
            rusqlite::params![key],
            |row| row.get(0),
        );
        Ok(result.unwrap_or(0))
    }
}

/// Cross-platform current time in epoch seconds.
fn chrono_now_secs() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}
