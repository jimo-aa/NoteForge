package com.noteforge.common.util;

public final class StringUtils {
    private StringUtils() {
    }

    public static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    public static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
