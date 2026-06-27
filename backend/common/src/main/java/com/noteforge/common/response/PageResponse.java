package com.noteforge.common.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import java.util.List;

@Data
@AllArgsConstructor
public class PageResponse<T> {
    private List<T> items;
    private int page;
    private int size;
    private long total;
    private int totalPages;
}
