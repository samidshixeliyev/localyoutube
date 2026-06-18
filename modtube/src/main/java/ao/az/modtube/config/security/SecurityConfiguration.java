package ao.az.modtube.config.security;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfiguration {

    private final JwtAuthenticationFilter jwtAuthFilter;
    private final UserDetailsService userDetailsService;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // ✅ CRITICAL: CORS MUST BE FIRST!!!
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))

                // ✅ Disable CSRF
                .csrf(AbstractHttpConfigurer::disable)

                // ✅ Disable CSP
                .headers(AbstractHttpConfigurer::disable)

                .authorizeHttpRequests(auth -> auth
                        // ── Static frontend (React SPA) ──────────────────────
                        .requestMatchers("/", "/index.html", "/favicon.ico").permitAll()
                        .requestMatchers("/assets/**", "/static/**").permitAll()
                        // Root-level static assets from Vite's public/ folder
                        .requestMatchers("/*.png", "/*.jpg", "/*.jpeg", "/*.svg", "/*.ico", "/*.webp").permitAll()
                        // SPA client-side routes — Spring serves index.html for all of these
                        .requestMatchers("/login", "/callback", "/logged_out",
                                "/video/**", "/embed/**", "/search", "/shorts",
                                "/upload", "/my-videos", "/change-password",
                                "/playlists", "/playlists/**", "/my-playlists",
                                "/meetings", "/meetings/**",
                                "/admin/**").permitAll()

                        // WebSocket signaling — auth handled by the handshake interceptor
                        .requestMatchers("/ws/**").permitAll()

                        // AUTHENTICATION - Public
                        .requestMatchers("/api/auth/login").permitAll()
                        .requestMatchers("/api/auth/refresh").permitAll()
                        .requestMatchers("/api/auth/idp/**").permitAll()

                        // App config (public upload/feature settings)
                        .requestMatchers("/api/config/**").permitAll()

                        // Swagger/OpenAPI - Public
                        .requestMatchers("/swagger-ui/**", "/v3/api-docs/**", "/swagger-ui.html").permitAll()

                        // Health + metrics - Public (Prometheus scrapes these without auth)
                        .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                        .requestMatchers("/actuator/prometheus").permitAll()
                        .requestMatchers("/actuator/info").permitAll()

                        // Video streaming - Public
                        .requestMatchers("/hls/**").permitAll()
                        .requestMatchers("/thumbnails/**").permitAll()
                        .requestMatchers("/originals/**").permitAll()
                        // Meeting chat attachments (unguessable UUID keys; deleted when meeting ends)
                        .requestMatchers("/meeting-files/**").permitAll()

                        // Video viewing - PUBLIC
                        .requestMatchers(HttpMethod.GET, "/api/videos").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/videos/*").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/videos/*/comments").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/videos/search").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/videos/suggestions").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/videos/shorts").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/videos/*/suggestions").permitAll()

                        // Share endpoints - PUBLIC
                        .requestMatchers(HttpMethod.GET, "/api/videos/*/share").permitAll()

                        // View increment - PUBLIC
                        .requestMatchers(HttpMethod.POST, "/api/videos/*/view").permitAll()

                        // Password change - authenticated
                        .requestMatchers(HttpMethod.POST, "/api/auth/change-password").authenticated()

                        // Comments - Authenticated
                        .requestMatchers(HttpMethod.POST, "/api/videos/*/comments").authenticated()
                        .requestMatchers(HttpMethod.DELETE, "/api/videos/*/comments/*").authenticated()

                        // Likes - Authenticated
                        .requestMatchers(HttpMethod.POST, "/api/videos/*/like").authenticated()
                        .requestMatchers(HttpMethod.DELETE, "/api/videos/*/like").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/videos/*/like-status").authenticated()

                        // ADMIN — granular sub-routes (must precede the catch-all below)
                        // Users with view-metrics can reach the metrics proxy
                        // ROLE_SUPER_ADMIN is included as fallback (role-based check mirrors permission-based)
                        .requestMatchers("/api/admin/metrics/**").hasAnyAuthority("super-admin", "view-metrics", "ROLE_SUPER_ADMIN")
                        // Users with manage-settings can read/write settings
                        .requestMatchers("/api/admin/settings/**").hasAnyAuthority("super-admin", "manage-settings", "ROLE_SUPER_ADMIN")
                        // Everything else (user/role management etc.) — super-admin only
                        .requestMatchers("/api/admin/**").hasAnyAuthority("super-admin", "ROLE_SUPER_ADMIN")

                        .requestMatchers("/api/upload/**").hasAnyAuthority("upload-video", "admin-modtube", "super-admin")

                        .requestMatchers(HttpMethod.PUT, "/api/videos/*").hasAnyAuthority("upload-video", "admin-modtube", "super-admin")
                        .requestMatchers(HttpMethod.PATCH, "/api/videos/*").hasAnyAuthority("upload-video", "admin-modtube", "super-admin")
                        .requestMatchers(HttpMethod.DELETE, "/api/videos/*").hasAnyAuthority("delete-video", "upload-video", "admin-modtube", "super-admin")
                        .requestMatchers(HttpMethod.POST, "/api/videos/*/thumbnail").hasAnyAuthority("upload-video", "admin-modtube", "super-admin")
                        .requestMatchers(HttpMethod.POST, "/api/videos/*/privacy").hasAnyAuthority("upload-video", "admin-modtube", "super-admin")

                        .requestMatchers("/api/playlists/**").authenticated()

                        // ── Meetings — split by operation ──────────────────────────────
                        // Creating/managing meetings requires video-call; manage-meetings
                        // lets moderators end/edit/delete ANY meeting.
                        .requestMatchers(HttpMethod.GET,    "/api/meetings").hasAnyAuthority("video-call", "manage-meetings", "super-admin")
                        .requestMatchers(HttpMethod.POST,   "/api/meetings").hasAnyAuthority("video-call", "super-admin")
                        .requestMatchers(HttpMethod.POST,   "/api/meetings/*/start").hasAnyAuthority("video-call", "manage-meetings", "super-admin")
                        .requestMatchers(HttpMethod.POST,   "/api/meetings/*/end").hasAnyAuthority("video-call", "manage-meetings", "super-admin")
                        // Inviting requires host/moderator authority
                        .requestMatchers(HttpMethod.POST,   "/api/meetings/*/invite").hasAnyAuthority("video-call", "manage-meetings", "super-admin")
                        // Joining (PIN/invite-token gated in the service) — any authenticated user
                        .requestMatchers(HttpMethod.POST,   "/api/meetings/*/join").authenticated()
                        // Chat attachment upload — any authenticated user (access checked in service)
                        .requestMatchers(HttpMethod.POST,   "/api/meetings/*/attachments").authenticated()
                        .requestMatchers(HttpMethod.PUT,    "/api/meetings/*").hasAnyAuthority("video-call", "manage-meetings", "super-admin")
                        .requestMatchers(HttpMethod.DELETE, "/api/meetings/*").hasAnyAuthority("video-call", "manage-meetings", "super-admin")
                        // GET single meeting or ice-config: any authenticated user (join by link)
                        .requestMatchers(HttpMethod.GET, "/api/meetings/**").authenticated()

                        // ── Notifications ──────────────────────────────────────────────
                        // /stream uses ?token= auth (EventSource can't set headers)
                        .requestMatchers("/api/notifications/stream").permitAll()
                        // Broadcast/announcements — admins only
                        .requestMatchers(HttpMethod.POST, "/api/notifications/broadcast").hasAnyAuthority("manage-notifications", "super-admin")
                        .requestMatchers("/api/notifications/**").authenticated()

                        // Actuator - admin-modtube OR super-admin
                        .requestMatchers("/actuator/**").hasAnyAuthority("admin-modtube", "super-admin")

                        // Everything else requires authentication
                        .anyRequest().authenticated()
                )
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )
                .authenticationProvider(authenticationProvider())
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    // ✅ NUCLEAR CORS CONFIGURATION - THIS WILL WORK
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        // Allow ALL origins
        configuration.setAllowedOriginPatterns(List.of("*"));

        // Allow ALL methods
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"));

        // Allow ALL headers
        configuration.setAllowedHeaders(List.of("*"));

        // Expose ALL headers
        configuration.setExposedHeaders(List.of("*"));

        // NO credentials with wildcard
        configuration.setAllowCredentials(false);

        // Cache preflight 1 hour
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);

        return source;
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        authProvider.setUserDetailsService(userDetailsService);
        authProvider.setPasswordEncoder(passwordEncoder());
        return authProvider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}