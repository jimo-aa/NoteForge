package com.noteforge.user.controller;

import com.noteforge.common.response.ApiResponse;
import com.noteforge.user.dto.UserResponse;
import com.noteforge.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> getMe(Authentication auth) {
        UserResponse user = userService.getUser(auth.getName());
        return ResponseEntity.ok(ApiResponse.success(user));
    }

    @PutMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> updateMe(
            Authentication auth,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String avatarUrl) {
        UserResponse user = userService.updateProfile(auth.getName(), name, avatarUrl);
        return ResponseEntity.ok(ApiResponse.success(user));
    }
}
