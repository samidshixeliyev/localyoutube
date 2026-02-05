package az.dev.localtube.util;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

@Slf4j
@Component
public class JwtUtil {

    private final SecretKey secretKey;

    public JwtUtil(@Value("${jwt.secret}") String secret) {
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String extractUsername(String token) {
        // Try to get email from custom claim, fall back to subject
        try {
            String email = extractCustomClaim(token, "email", String.class);
            if (email != null) return email;
        } catch (Exception ignored) {
        }

        return extractClaim(token, Claims::getSubject);
    }

    public Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    public Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public Boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    public Boolean validateToken(String token, UserDetails userDetails) {
        final String username = extractUsername(token);
        return (username.equals(userDetails.getUsername()) && !isTokenExpired(token));
    }

    public <T> T extractCustomClaim(String token, String claimName, Class<T> requiredType) {
        final Claims claims = extractAllClaims(token);
        return claims.get(claimName, requiredType);
    }

    /**
     * Generate JWT token with user details and roles
     */
    public String generateToken(String email, Long userId, String role, List<String> permissions) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("email", email);
        claims.put("userId", userId);
        claims.put("role", role);
        claims.put("permissions", permissions);

        return Jwts.builder()
                .claims(claims)
                .subject(email)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 1000 * 60 * 60 * 24)) // 24 hours
                .signWith(secretKey)
                .compact();
    }

    /**
     * Check if token is about to expire (within 5 minutes)
     */
    public boolean isTokenExpiringSoon(String token) {
        try {
            Date expiration = extractExpiration(token);
            Date now = new Date();

            // Check if token expires in less than 5 minutes (300000 ms)
            long timeUntilExpiration = expiration.getTime() - now.getTime();
            return timeUntilExpiration < 300000; // 5 minutes
        } catch (Exception e) {
            return true; // If we can't check, assume it needs refresh
        }
    }

    /**
     * Get remaining time in seconds before token expires
     */
    public long getTimeUntilExpiration(String token) {
        try {
            Date expiration = extractExpiration(token);
            Date now = new Date();
            return (expiration.getTime() - now.getTime()) / 1000;
        } catch (Exception e) {
            return 0;
        }
    }

    /**
     * Check if token is valid (not expired)
     */
    public boolean isTokenValid(String token) {
        try {
            return !isTokenExpired(token);
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Extract role from token
     */
    public String extractRole(String token) {
        return extractCustomClaim(token, "role", String.class);
    }

    /**
     * Extract email from token
     */
    public String extractEmail(String token) {
        return extractCustomClaim(token, "email", String.class);
    }


    /**
     * Extract permissions from token
     */
    @SuppressWarnings("unchecked")
    public List<String> extractPermissions(String token) {
        return extractCustomClaim(token, "permissions", List.class);
    }

    /**
     * Extract user ID from token
     */
    public Long extractUserId(String token) {
        Object userId = extractAllClaims(token).get("userId");
        if (userId instanceof Integer) {
            return ((Integer) userId).longValue();
        }
        return (Long) userId;
    }
}