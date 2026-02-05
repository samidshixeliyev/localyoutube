package az.dev.localtube.config.security;

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
                .csrf(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth
                        // ═══════════════════════════════════════════════════════════════
                        // AUTHENTICATION ENDPOINTS - Public
                        // ═══════════════════════════════════════════════════════════════
                        .requestMatchers("/api/auth/login").permitAll()
                        .requestMatchers("/api/auth/refresh").permitAll()

                        // ═══════════════════════════════════════════════════════════════
                        // PUBLIC ACCESS - No authentication required
                        // ═══════════════════════════════════════════════════════════════

                        // Swagger/OpenAPI - Public
                        .requestMatchers("/swagger-ui/**", "/v3/api-docs/**", "/swagger-ui.html").permitAll()

                        // Health check - Public
                        .requestMatchers("/actuator/health").permitAll()

                        // Video streaming - Public (HLS and thumbnails)
                        .requestMatchers("/hls/**").permitAll()
                        .requestMatchers("/thumbnails/**").permitAll()

                        // Video viewing - PUBLIC (all GET requests)
                        .requestMatchers(HttpMethod.GET, "/api/videos").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/videos/*").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/videos/*/comments").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/videos/search").permitAll()

                        // Share endpoints - PUBLIC
                        .requestMatchers(HttpMethod.GET, "/api/videos/*/share").permitAll()

                        // View increment - PUBLIC (for analytics)
                        .requestMatchers(HttpMethod.POST, "/api/videos/*/view").permitAll()

                        // ═══════════════════════════════════════════════════════════════
                        // AUTHENTICATED USER ACCESS - Require login
                        // ═══════════════════════════════════════════════════════════════

                        // Comments - Authenticated users can create
                        .requestMatchers(HttpMethod.POST, "/api/videos/*/comments").authenticated()

                        // Delete own comments - Authenticated users
                        .requestMatchers(HttpMethod.DELETE, "/api/videos/*/comments/*").authenticated()

                        // Likes - Authenticated users only
                        .requestMatchers(HttpMethod.POST, "/api/videos/*/like").authenticated()
                        .requestMatchers(HttpMethod.DELETE, "/api/videos/*/like").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/videos/*/like-status").authenticated()

                        // ═══════════════════════════════════════════════════════════════
                        // ADMIN-MODTUBE PERMISSION REQUIRED
                        // ═══════════════════════════════════════════════════════════════

                        // Video upload
                        .requestMatchers("/api/upload/**").hasAuthority("admin-modtube")

                        // Video management
                        .requestMatchers(HttpMethod.PUT, "/api/videos/*").hasAuthority("admin-modtube")
                        .requestMatchers(HttpMethod.PATCH, "/api/videos/*").hasAuthority("admin-modtube")
                        .requestMatchers(HttpMethod.DELETE, "/api/videos/*").hasAuthority("admin-modtube")

                        // Thumbnail management
                        .requestMatchers(HttpMethod.POST, "/api/videos/*/thumbnail").hasAuthority("admin-modtube")

                        // Video privacy/visibility settings
                        .requestMatchers(HttpMethod.POST, "/api/videos/*/privacy").hasAuthority("admin-modtube")

                        // Admin metrics
                        .requestMatchers("/actuator/**").hasAuthority("admin-modtube")

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