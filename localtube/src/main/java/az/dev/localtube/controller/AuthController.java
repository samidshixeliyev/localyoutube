package az.dev.localtube.controller;

import az.dev.localtube.config.security.LocalTubePrincipal;
import az.dev.localtube.config.security.LocalTubeUserDetails;
import az.dev.localtube.dto.request.ChangePasswordRequest;
import az.dev.localtube.dto.request.LoginRequest;
import az.dev.localtube.dto.response.LoginResponse;
import az.dev.localtube.entity.User;
import az.dev.localtube.repository.UserRepository;
import az.dev.localtube.service.SystemSettingService;
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
    private final SystemSettingService settings;

    // Fallback defaults (used if DB not yet migrated or setting missing)
    @Value("${localtube.idp.base-url:https://13.61.159.58}")
    private String defaultIdpBaseUrl;
    @Value("${localtube.idp.client-id:EFxbQK-ekDX1OkWov51cjg}")
    private String defaultIdpClientId;
    @Value("${localtube.idp.issuer:https://auth.ao.az}")
    private String defaultIdpIssuer;
    @Value("${localtube.idp.redirect-uri:http://13.61.159.58:4000/}")
    private String defaultIdpRedirectUri;
    @Value("${localtube.idp.logout-redirect-uri:http://13.61.159.58:4000/logged_out}")
    private String defaultIdpLogoutRedirectUri;

    // Live values — read from DB on every request so admin changes take effect immediately
    private String idpBaseUrl()          { return settings.get("idp.base-url",            defaultIdpBaseUrl); }
    private String idpClientId()         { return settings.get("idp.client-id",           defaultIdpClientId); }
    private String idpIssuer()           { return settings.get("idp.issuer",               defaultIdpIssuer); }
    private String idpRedirectUri()      { return settings.get("idp.redirect-uri",         defaultIdpRedirectUri); }
    private String idpLogoutRedirectUri(){ return settings.get("idp.logout-redirect-uri",  defaultIdpLogoutRedirectUri); }

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
        return ResponseEntity.ok(Map.ofEntries(
                Map.entry("authorizationEndpoint", idpBaseUrl() + "/oauth2/authorize"),
                Map.entry("tokenEndpoint",         idpBaseUrl() + "/oauth2/token"),
                Map.entry("endSessionEndpoint",    idpBaseUrl() + "/oauth2/logout"),
                Map.entry("clientId",              idpClientId()),
                Map.entry("scope",                 "openid profile"),
                Map.entry("issuer",                idpIssuer()),
                Map.entry("redirectUri",           idpRedirectUri()),
                Map.entry("logoutRedirectUri",     idpLogoutRedirectUri()),
                Map.entry("idpEnabled",            settings.get("idp.enabled", "true")),
                // JWT claim name mappings — used by frontend to decode id_token
                Map.entry("claimEmail",            settings.get("idp.claim.email",    "mail")),
                Map.entry("claimFullName",         settings.get("idp.claim.fullname", "cn")),
                Map.entry("claimFirst",            settings.get("idp.claim.first",    "givenName")),
                Map.entry("claimLast",             settings.get("idp.claim.last",     "sn")),
                Map.entry("claimUsername",         settings.get("idp.claim.username", "uid"))
        ));
    }

    /**
     * Proxies PKCE token exchange to the IDP (public client — no client_secret).
     * Uses curl -k to bypass self-signed certificate hostname verification which
     * Java 21's TLS stack enforces even with custom TrustManager/HostnameVerifier.
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

            String tokenUrl = idpBaseUrl() + "/oauth2/token";

            // curl -k bypasses Java's TLS hostname verification for self-signed certs with IP SANs.
            // ProcessBuilder avoids shell injection — args are passed directly to the OS.
            ProcessBuilder pb = new ProcessBuilder(
                    "curl", "-k", "-s",
                    "-X", "POST", tokenUrl,
                    "-H", "Content-Type: application/x-www-form-urlencoded",
                    "--data-urlencode", "grant_type=authorization_code",
                    "--data-urlencode", "code=" + code,
                    "--data-urlencode", "redirect_uri=" + redirectUri,
                    "--data-urlencode", "code_verifier=" + codeVerifier,
                    "--data-urlencode", "client_id=" + idpClientId(),
                    "-w", "\n%{http_code}"
            );
            pb.redirectErrorStream(true);

            Process process = pb.start();
            String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            process.waitFor();

            // curl appends "\n<http_code>" at the end due to -w "%{http_code}"
            int lastNewline = output.lastIndexOf('\n');
            String responseBody = lastNewline > 0 ? output.substring(0, lastNewline).trim() : output;
            String statusStr   = lastNewline > 0 ? output.substring(lastNewline + 1).trim() : "0";

            int status;
            try {
                status = Integer.parseInt(statusStr);
                // 0 or 000 means curl couldn't connect at all
                if (status < 100 || status > 599) {
                    log.error("IDP unreachable — curl output: {}", output.length() > 500 ? output.substring(0, 500) : output);
                    return ResponseEntity.status(502)
                            .body("{\"error\":\"IDP server unreachable. Check IDP base URL in admin settings.\"}");
                }
            } catch (NumberFormatException ignore) {
                status = 502;
            }

            log.info("IDP token exchange returned status: {} via curl", status);
            return ResponseEntity.status(status)
                    .header("Content-Type", "application/json")
                    .body(responseBody);

        } catch (Exception e) {
            log.error("IDP token exchange failed: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body("{\"error\":\"IDP token exchange failed: " + e.getMessage() + "\"}");
        }
    }

    /**
     * Called by the frontend after IDP token exchange to sync id_token claims
     * (display_name, email, ldap_username) into the local DB user record.
     * The access_token only carries sub (UUID); the id_token has the real profile.
     */
    @PostMapping("/idp/sync-profile")
    public ResponseEntity<?> syncIdpProfile(
            @RequestBody Map<String, String> claims,
            @AuthenticationPrincipal LocalTubePrincipal principal) {
        try {
            if (principal == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "Not authenticated"));
            }

            String currentEmail = principal.getEmail(); // UUID or real email in DB
            User user = userRepository.findUserByEmail(currentEmail)
                    .orElse(null);
            if (user == null) {
                return ResponseEntity.ok(Map.of("synced", false, "reason", "user not found"));
            }

            // LDAP claim names from the Global Bank IDP:
            //   cn        = full name ("Daniel Hernandez")
            //   givenName = first name, sn = surname
            //   mail      = email address
            //   uid       = login username
            String displayName = firstNonBlank(
                    claims.get("cn"),
                    buildFullName(claims.get("givenName"), claims.get("sn")),
                    claims.get("uid"),
                    claims.get("display_name"),
                    claims.get("name"),
                    buildFullName(claims.get("given_name"), claims.get("family_name")),
                    claims.get("ldap_username"),
                    claims.get("preferred_username")
            );

            // Extract real email — LDAP uses "mail", OIDC uses "email"
            String realEmail = firstNonBlank(
                    claims.get("mail"),
                    claims.get("email"),
                    claims.get("preferred_username")
            );

            boolean changed = false;

            if (displayName != null) {
                String[] parts = displayName.trim().split("\\s+", 2);
                String firstName = parts[0];
                String surname = parts.length > 1 ? parts[1] : null;
                if (!firstName.equals(user.getName())) { user.setName(firstName); changed = true; }
                if (!java.util.Objects.equals(surname, user.getSurname())) { user.setSurname(surname); changed = true; }
            }

            // Only update email if the current one is a UUID (placeholder from provisioning)
            if (realEmail != null && isUuidEmail(currentEmail) && !realEmail.equals(currentEmail)) {
                // Check no other user owns the real email
                if (userRepository.findUserByEmail(realEmail).isEmpty()) {
                    user.setEmail(realEmail);
                    changed = true;
                    log.info("IDP profile sync: updated email {} → {} for user id={}", currentEmail, realEmail, user.getId());
                }
            }

            if (changed) {
                user.setUpdatedAt(LocalDateTime.now());
                userRepository.save(user);
                log.info("IDP profile synced for user id={}: name={} {}", user.getId(), user.getName(), user.getSurname());
            }

            return ResponseEntity.ok(Map.of("synced", changed, "name", user.getFullName(), "email", user.getEmail()));
        } catch (Exception e) {
            log.error("IDP profile sync failed: {}", e.getMessage(), e);
            return ResponseEntity.ok(Map.of("synced", false, "error", e.getMessage()));
        }
    }

    private String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }

    private String buildFullName(String given, String family) {
        if (given == null && family == null) return null;
        if (family == null) return given;
        if (given == null) return family;
        return given + " " + family;
    }

    private boolean isUuidEmail(String email) {
        // UUIDs used as placeholder email: 8-4-4-4-12 hex pattern
        return email != null && email.matches(
                "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
    }

    @lombok.Data
    @lombok.AllArgsConstructor
    static class ErrorResponse {
        private String message;
    }
}