package com.noteforge.user.dto;

import com.noteforge.user.entity.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RegisterRequest {

    @NotBlank @Email
    private String email;

    @NotBlank @Size(min = 6, max = 128)
    private String password;

    @NotBlank @Size(max = 64)
    private String name;

    private UserRole role;
}
