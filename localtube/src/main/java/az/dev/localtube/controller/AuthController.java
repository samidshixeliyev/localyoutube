package az.dev.localtube.controller;

import az.dev.localtube.dto.request.LoginRequest;
import az.dev.localtube.dto.response.LoginResponse;
import az.dev.localtube.entity.User;
import az.dev.localtube.repository.UserRepository;
import az.dev.localtube.util.JwtUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    /**
     * Login endpoint - returns JWT with roles and permissions
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        try {
            // Find user by email
            User user = userRepository.findUserByEmail(request.getEmail())
                    .orElseThrow(() -> new RuntimeException("Invalid email or password"));

            // Verify password
            if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new ErrorResponse("Invalid email or password"));
            }

            // Extract role and permissions
            String roleName = user.getRole().getName();
            List<String> permissions = user.getRole().getPermissions().stream()
                    .map(p -> p.getName())
                    .collect(Collectors.toList());

            // Generate JWT with role and permissions
            String token = jwtUtil.generateToken(
                    user.getEmail(),
                    user.getId(),
                    roleName,
                    permissions
            );

            // Build response
            LoginResponse response = LoginResponse.builder()
                    .email(user.getEmail())
                    .name(user.getName())
                    .fullName(user.getFullName())
                    .userId(user.getId())
                    .accessToken(token)
                    .tokenType("Bearer")
                    .role(roleName)
                    .permissions(permissions)
                    .build();

            log.info("User logged in: {} with role: {}", user.getEmail(), roleName);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Login error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("Invalid email or password"));
        }
    }

    /**
     * Refresh token endpoint - issues new token if current one is valid
     */
    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(@RequestHeader("Authorization") String authHeader) {
        try {
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new ErrorResponse("Missing or invalid authorization header"));
            }

            String token = authHeader.substring(7);
            
            // Extract user info from current token
            String email = jwtUtil.extractEmail(token);
            
            // Find user
            User user = userRepository.findUserByEmail(email)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            // Extract role and permissions
            String roleName = user.getRole().getName();
            List<String> permissions = user.getRole().getPermissions().stream()
                    .map(p -> p.getName())
                    .collect(Collectors.toList());

            // Generate NEW token
            String newToken = jwtUtil.generateToken(
                    user.getEmail(),
                    user.getId(),
                    roleName,
                    permissions
            );

            // Build response
            LoginResponse response = LoginResponse.builder()
                    .email(user.getEmail())
                    .name(user.getName())
                    .fullName(user.getFullName())
                    .userId(user.getId())
                    .accessToken(newToken)
                    .tokenType("Bearer")
                    .role(roleName)
                    .permissions(permissions)
                    .build();

            log.info("Token refreshed for user: {}", user.getEmail());
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Token refresh error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("Token refresh failed"));
        }
    }

    /**
     * Verify token and return user info
     */
    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(@RequestHeader("Authorization") String authHeader) {
        try {
            String token = authHeader.substring(7); // Remove "Bearer "
            
            String email = jwtUtil.extractEmail(token);
            Long userId = jwtUtil.extractUserId(token);
            String role = jwtUtil.extractRole(token);
            List<String> permissions = jwtUtil.extractPermissions(token);

            User user = userRepository.findUserByEmail(email)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            LoginResponse response = LoginResponse.builder()
                    .email(user.getEmail())
                    .name(user.getName())
                    .fullName(user.getFullName())
                    .userId(user.getId())
                    .role(role)
                    .permissions(permissions)
                    .build();

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("Invalid token"));
        }
    }

    // Error response helper class
    @lombok.Data
    @lombok.AllArgsConstructor
    static class ErrorResponse {
        private String message;
    }
}