package az.dev.localtube.controller;

import az.dev.localtube.config.security.LocalTubeUserDetails;
import az.dev.localtube.dto.request.ChangePasswordRequest;
import az.dev.localtube.dto.request.LoginRequest;
import az.dev.localtube.dto.response.LoginResponse;
import az.dev.localtube.entity.User;
import az.dev.localtube.repository.UserRepository;
import az.dev.localtube.util.JwtUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    @Value("${localtube.idp.base-url}")
    private String idpBaseUrl;

    @Value("${localtube.idp.client-id}")
    private String idpClientId;

    @Value("${localtube.idp.issuer:https://auth.ao.az}")
    private String idpIssuer;

    @Value("${localtube.idp.redirect-uri:http://51.20.12.6:4000/}")
    private String idpRedirectUri;

    @Value("${localtube.idp.logout-redirect-uri:http://51.20.12.6:4000/logged_out}")
    private String idpLogoutRedirectUri;

    private static final HttpClient HTTP_CLIENT = buildSslIgnoringClient();

    private static HttpClient buildSslIgnoringClient() {
        try {
            javax.net.ssl.SSLContext sc = javax.net.ssl.SSLContext.getInstance("TLS");
            sc.init(null, new javax.net.ssl.TrustManager[]{
                new javax.net.ssl.X509TrustManager() {
                    public java.security.cert.X509Certificate[] getAcceptedIssuers() { return new java.security.cert.X509Certificate[0]; }
                    public void checkClientTrusted(java.security.cert.X509Certificate[] c, String a) {}
                    public void checkServerTrusted(java.security.cert.X509Certificate[] c, String a) {}
                }
            }, new java.security.SecureRandom());
            return HttpClient.newBuilder()
                    .sslContext(sc)
                    .build();
        } catch (Exception e) {
            return HttpClient.newHttpClient();
        }
    }

    /**
     * Login endpoint - returns JWT with roles and permissions
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        try {
            User user = userRepository.findUserByEmail(request.getEmail())
                    .orElseThrow(() -> new RuntimeException("Invalid email or password"));

            if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new ErrorResponse("Invalid email or password"));
            }

            String roleName = user.getRole().getName();
            List<String> permissions = user.getRole().getPermissions().stream()
                    .map(p -> p.getName())
                    .collect(Collectors.toList());

            String token = jwtUtil.generateToken(
                    user.getEmail(),
                    user.getId(),
                    roleName,
                    permissions
            );

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
     * Refresh token endpoint
     */
    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(@RequestHeader("Authorization") String authHeader) {
        try {
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new ErrorResponse("Missing or invalid authorization header"));
            }

            String token = authHeader.substring(7);
            String email = jwtUtil.extractEmail(token);

            User user = userRepository.findUserByEmail(email)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            String roleName = user.getRole().getName();
            List<String> permissions = user.getRole().getPermissions().stream()
                    .map(p -> p.getName())
                    .collect(Collectors.toList());

            String newToken = jwtUtil.generateToken(
                    user.getEmail(),
                    user.getId(),
                    roleName,
                    permissions
            );

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
            String token = authHeader.substring(7);

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

    /**
     * Change own password - any authenticated user
     */
    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            @AuthenticationPrincipal LocalTubeUserDetails userDetails) {
        try {
            User user = userRepository.findUserByEmail(userDetails.getEmail())
                    .orElseThrow(() -> new RuntimeException("User not found"));

            // Verify current password
            if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Current password is incorrect"));
            }

            user.setPassword(passwordEncoder.encode(request.getNewPassword()));
            user.setUpdatedAt(LocalDateTime.now());
            userRepository.save(user);

            log.info("Password changed for user: {}", user.getEmail());
            return ResponseEntity.ok(Map.of("message", "Password changed successfully"));

        } catch (Exception e) {
            log.error("Password change error: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Failed to change password"));
        }
    }

    /**
     * Returns IDP config so the frontend can build the authorization URL.
     */
    @GetMapping("/idp/config")
    public ResponseEntity<Map<String, String>> getIdpConfig() {
        return ResponseEntity.ok(Map.of(
                "authorizationEndpoint", idpBaseUrl + "/oauth2/authorize",
                "tokenEndpoint", idpBaseUrl + "/oauth2/token",
                "endSessionEndpoint", idpBaseUrl + "/oauth2/logout",
                "clientId", idpClientId,
                "scope", "openid profile",
                "issuer", idpIssuer,
                "redirectUri", idpRedirectUri,
                "logoutRedirectUri", idpLogoutRedirectUri
        ));
    }

    /**
     * Proxies PKCE token exchange to the IDP (public client — no client_secret).
     * Frontend sends: { code, redirect_uri, code_verifier }
     */
    @PostMapping("/idp/token")
    public ResponseEntity<String> exchangeIdpToken(@RequestBody Map<String, String> body) {
        try {
            String code = body.get("code");
            String redirectUri = body.get("redirect_uri");
            String codeVerifier = body.get("code_verifier");

            if (code == null || redirectUri == null || codeVerifier == null) {
                return ResponseEntity.badRequest().body("{\"error\":\"missing required fields\"}");
            }

            String formBody = "grant_type=" + URLEncoder.encode("authorization_code", StandardCharsets.UTF_8)
                    + "&code=" + URLEncoder.encode(code, StandardCharsets.UTF_8)
                    + "&redirect_uri=" + URLEncoder.encode(redirectUri, StandardCharsets.UTF_8)
                    + "&code_verifier=" + URLEncoder.encode(codeVerifier, StandardCharsets.UTF_8)
                    + "&client_id=" + URLEncoder.encode(idpClientId, StandardCharsets.UTF_8);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(idpBaseUrl + "/oauth2/token"))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(formBody))
                    .build();

            HttpResponse<String> idpResponse = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
            log.info("IDP token exchange returned status: {}", idpResponse.statusCode());

            return ResponseEntity.status(idpResponse.statusCode())
                    .header("Content-Type", "application/json")
                    .body(idpResponse.body());

        } catch (Exception e) {
            log.error("IDP token exchange failed: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body("{\"error\":\"IDP token exchange failed\"}");
        }
    }

    @lombok.Data
    @lombok.AllArgsConstructor
    static class ErrorResponse {
        private String message;
    }
}