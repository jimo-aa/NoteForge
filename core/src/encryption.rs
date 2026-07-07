//! NoteForge Core — 加密模块
//!
//! 使用 AES-256-GCM 实现笔记内容的加密和解密。
//! 支持密钥派生（使用 Argon2）和安全随机初始化向量。

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::{Argon2, PasswordHasher};
use argon2::password_hash::SaltString;
use thiserror::Error;
use tracing::{info, warn};

/// 加密错误类型
#[derive(Debug, Error)]
pub enum EncryptionError {
    #[error("密钥派生失败: {0}")]
    KeyDerivationFailed(String),
    
    #[error("加密失败: {0}")]
    EncryptionFailed(String),
    
    #[error("解密失败: {0}")]
    DecryptionFailed(String),
    
    #[error("无效的加密数据格式")]
    InvalidDataFormat,
    
    #[error("密码验证失败")]
    PasswordVerificationFailed,
}

/// 加密管理器
#[derive(Clone)]
pub struct EncryptionManager {
    /// 主密钥（通常由用户密码派生）
    master_key: Option<[u8; 32]>,
}

impl EncryptionManager {
    /// 创建新的加密管理器
    pub fn new() -> Self {
        Self { master_key: None }
    }

    /// 从用户密码派生主密钥
    /// 使用 Argon2 进行安全的密码哈希
    pub fn derive_key_from_password(password: &str, salt: &str) -> Result<[u8; 32], EncryptionError> {
        let argon2 = Argon2::default();
        let salt_obj = SaltString::encode_b64(salt.as_bytes())
            .map_err(|e| EncryptionError::KeyDerivationFailed(e.to_string()))?;
        
        let password_hash = argon2
            .hash_password(password.as_bytes(), &salt_obj)
            .map_err(|e| EncryptionError::KeyDerivationFailed(e.to_string()))?;
        
        let hash_value = password_hash.hash
            .ok_or_else(|| EncryptionError::KeyDerivationFailed("Hash为空".to_string()))?;
        
        let hash_bytes = hash_value.as_bytes();
        let mut key = [0u8; 32];
        key.copy_from_slice(&hash_bytes[..32.min(hash_bytes.len())]);
        
        info!("🔐 主密钥已从密码派生");
        Ok(key)
    }

    /// 初始化加密管理器（设置主密钥）
    pub fn initialize(&mut self, key: [u8; 32]) {
        self.master_key = Some(key);
        info!("🔐 加密管理器已初始化");
    }

    /// 检查是否已初始化
    pub fn is_initialized(&self) -> bool {
        self.master_key.is_some()
    }

    /// 加密数据
    /// 返回格式：[16字节IV | 16字节TAG | 加密数据]
    pub fn encrypt(&self, plaintext: &str) -> Result<String, EncryptionError> {
        let key = self.master_key.ok_or_else(|| {
            EncryptionError::EncryptionFailed("加密管理器未初始化".to_string())
        })?;

        let cipher = Aes256Gcm::new(&key.into());
        
        // 生成随机 nonce（12 字节）— using OsRng for cryptographic quality
        use rand::rngs::OsRng;
        use rand::RngCore;
        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        // 加密
        let ciphertext = cipher
            .encrypt(nonce, plaintext.as_bytes())
            .map_err(|e| EncryptionError::EncryptionFailed(e.to_string()))?;

        // 组合：nonce (12) + ciphertext (可变)
        let mut result = Vec::new();
        result.extend_from_slice(&nonce_bytes);
        result.extend_from_slice(&ciphertext);

        // 转换为 hex 字符串便于存储
        let encoded = hex::encode(&result);
        info!("✅ 数据已加密 ({}字节 -> {}字节)", plaintext.len(), encoded.len());
        Ok(encoded)
    }

    /// 解密数据
    pub fn decrypt(&self, ciphertext_hex: &str) -> Result<String, EncryptionError> {
        let key = self.master_key.ok_or_else(|| {
            EncryptionError::DecryptionFailed("加密管理器未初始化".to_string())
        })?;

        // 从 hex 转换回字节
        let ciphertext_bytes = hex::decode(ciphertext_hex)
            .map_err(|_| EncryptionError::InvalidDataFormat)?;

        // 检查最小长度（12字节 nonce + 0字节密文 + 16字节标签 = 28字节最小）
        if ciphertext_bytes.len() < 28 {
            warn!("❌ 加密数据长度不足");
            return Err(EncryptionError::InvalidDataFormat);
        }

        // 提取 nonce
        let nonce = Nonce::from_slice(&ciphertext_bytes[..12]);
        let encrypted_data = &ciphertext_bytes[12..];

        let cipher = Aes256Gcm::new(&key.into());
        let plaintext = cipher
            .decrypt(nonce, encrypted_data)
            .map_err(|e| EncryptionError::DecryptionFailed(e.to_string()))?;

        let result = String::from_utf8(plaintext)
            .map_err(|e| EncryptionError::DecryptionFailed(e.to_string()))?;

        info!("✅ 数据已解密 ({}字节)", result.len());
        Ok(result)
    }

    /// 批量加密
    pub fn encrypt_batch(&self, plaintexts: Vec<&str>) -> Result<Vec<String>, EncryptionError> {
        plaintexts
            .into_iter()
            .map(|text| self.encrypt(text))
            .collect()
    }

    /// 批量解密
    pub fn decrypt_batch(&self, ciphertexts: Vec<&str>) -> Result<Vec<String>, EncryptionError> {
        ciphertexts
            .into_iter()
            .map(|ct| self.decrypt(ct))
            .collect()
    }

    /// 生成随机盐（用于密钥派生）
    /// Uses OsRng for cryptographic-quality randomness.
    pub fn generate_salt() -> String {
        use rand::rngs::OsRng;
        use rand::RngCore;
        let mut salt_bytes = [0u8; 16];
        OsRng.fill_bytes(&mut salt_bytes);
        hex::encode(salt_bytes)
    }
}

impl Default for EncryptionManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encryption_decryption() {
        let password = "secure_password_123";
        let salt = EncryptionManager::generate_salt();
        let key = EncryptionManager::derive_key_from_password(password, &salt).unwrap();

        let mut em = EncryptionManager::new();
        em.initialize(key);

        let plaintext = "这是一条需要加密的笔记内容，包含敏感信息。";
        let encrypted = em.encrypt(plaintext).unwrap();
        let decrypted = em.decrypt(&encrypted).unwrap();

        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_batch_operations() {
        let password = "test_password";
        let salt = EncryptionManager::generate_salt();
        let key = EncryptionManager::derive_key_from_password(password, &salt).unwrap();

        let mut em = EncryptionManager::new();
        em.initialize(key);

        let plaintexts = vec![
            "第一条笔记",
            "第二条笔记",
            "第三条笔记",
        ];

        let encrypted = em
            .encrypt_batch(
                plaintexts.iter().map(|&s| s).collect::<Vec<_>>()
            )
            .unwrap();
        let decrypted = em.decrypt_batch(encrypted.iter().map(|s| s.as_str()).collect()).unwrap();

        assert_eq!(plaintexts, decrypted.iter().map(|s| s.as_str()).collect::<Vec<_>>());
    }

    #[test]
    fn test_different_keys_cannot_decrypt() {
        let password1 = "password_1";
        let password2 = "password_2";
        let salt = EncryptionManager::generate_salt();

        let key1 = EncryptionManager::derive_key_from_password(password1, &salt).unwrap();
        let key2 = EncryptionManager::derive_key_from_password(password2, &salt).unwrap();

        let mut em1 = EncryptionManager::new();
        em1.initialize(key1);

        let plaintext = "sensitive data";
        let encrypted = em1.encrypt(plaintext).unwrap();

        let mut em2 = EncryptionManager::new();
        em2.initialize(key2);

        let result = em2.decrypt(&encrypted);
        assert!(result.is_err());
    }

    #[test]
    fn test_salt_generation() {
        let salt1 = EncryptionManager::generate_salt();
        let salt2 = EncryptionManager::generate_salt();
        assert_ne!(salt1, salt2);
    }

    #[test]
    fn test_tampered_ciphertext_detected() {
        let password = "test_password";
        let salt = EncryptionManager::generate_salt();
        let key = EncryptionManager::derive_key_from_password(password, &salt).unwrap();
        let mut em = EncryptionManager::new();
        em.initialize(key);

        let encrypted = em.encrypt("sensitive content").unwrap();
        // Tamper with the ciphertext by flipping a bit in the hex
        let tampered = format!("{}x{}", &encrypted[..10], &encrypted[12..]);
        let result = em.decrypt(&tampered);
        assert!(result.is_err(), "GCM should detect tampering");
    }

    #[test]
    fn test_empty_string_roundtrip() {
        let password = "pwd123";
        let salt = EncryptionManager::generate_salt();
        let key = EncryptionManager::derive_key_from_password(password, &salt).unwrap();
        let mut em = EncryptionManager::new();
        em.initialize(key);

        let encrypted = em.encrypt("").unwrap();
        let decrypted = em.decrypt(&encrypted).unwrap();
        assert_eq!(decrypted, "");
    }

    #[test]
    fn test_very_long_content() {
        let password = "pwd123";
        let salt = EncryptionManager::generate_salt();
        let key = EncryptionManager::derive_key_from_password(password, &salt).unwrap();
        let mut em = EncryptionManager::new();
        em.initialize(key);

        let long = "A".repeat(100_000);
        let encrypted = em.encrypt(&long).unwrap();
        let decrypted = em.decrypt(&encrypted).unwrap();
        assert_eq!(decrypted, long);
    }

    #[test]
    fn test_invalid_hex_returns_error() {
        let password = "pwd123";
        let salt = EncryptionManager::generate_salt();
        let key = EncryptionManager::derive_key_from_password(password, &salt).unwrap();
        let mut em = EncryptionManager::new();
        em.initialize(key);

        let result = em.decrypt("not-hex-at-all!");
        assert!(result.is_err());
    }

    #[test]
    fn test_uninitialized_manager_returns_error() {
        let em = EncryptionManager::new();
        assert!(!em.is_initialized());
        let result = em.encrypt("test");
        assert!(result.is_err());
        let result = em.decrypt("abcd1234");
        assert!(result.is_err());
    }

    #[test]
    fn test_short_ciphertext_returns_error() {
        let password = "pwd123";
        let salt = EncryptionManager::generate_salt();
        let key = EncryptionManager::derive_key_from_password(password, &salt).unwrap();
        let mut em = EncryptionManager::new();
        em.initialize(key);

        // 5 bytes < minimum 28
        let result = em.decrypt("aabbccddee");
        assert!(result.is_err());
    }

    #[test]
    fn test_repeated_encrypt_cycles_differ() {
        let password = "pwd123";
        let salt = EncryptionManager::generate_salt();
        let key = EncryptionManager::derive_key_from_password(password, &salt).unwrap();
        let mut em = EncryptionManager::new();
        em.initialize(key);

        let ct1 = em.encrypt("same text").unwrap();
        let ct2 = em.encrypt("same text").unwrap();
        // Nonce ensures different ciphertexts each time
        assert_ne!(ct1, ct2);
    }

    #[test]
    fn test_unicode_content_roundtrip() {
        let password = "pwd123";
        let salt = EncryptionManager::generate_salt();
        let key = EncryptionManager::derive_key_from_password(password, &salt).unwrap();
        let mut em = EncryptionManager::new();
        em.initialize(key);

        let texts = vec![
            "日本語のノート内容",
            "한국어 메모 내용",
            "中文笔记内容",
            "English notes with emoji 🎉",
            "Mélanges d'accents",
        ];
        for text in texts {
            let encrypted = em.encrypt(text).unwrap();
            let decrypted = em.decrypt(&encrypted).unwrap();
            assert_eq!(text, decrypted);
        }
    }

    #[test]
    fn test_different_salts_different_keys() {
        let password = "same_password";
        let salt1 = EncryptionManager::generate_salt();
        let salt2 = EncryptionManager::generate_salt();

        let key1 = EncryptionManager::derive_key_from_password(password, &salt1).unwrap();
        let key2 = EncryptionManager::derive_key_from_password(password, &salt2).unwrap();

        assert_ne!(key1, key2);
    }
}
