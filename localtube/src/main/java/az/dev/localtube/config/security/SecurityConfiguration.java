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
                        // AUTHENTICATION - Public
                        .requestMatchers("/api/auth/login").permitAll()
                        .requestMatchers("/api/auth/refresh").permitAll()

                        // Swagger/OpenAPI - Public
                        .requestMatchers("/swagger-ui/**", "/v3/api-docs/**", "/swagger-ui.html").permitAll()

                        // Health check - Public
                        .requestMatchers("/actuator/health").permitAll()

                        // Video streaming - Public
                        .requestMatchers("/hls/**").permitAll()
                        .requestMatchers("/thumbnails/**").permitAll()

                        // Video viewing - PUBLIC
                        .requestMatchers(HttpMethod.GET, "/api/videos").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/videos/*").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/videos/*/comments").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/videos/search").permitAll()
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

                        // SUPER-ADMIN ONLY
                        .requestMatchers("/api/admin/**").hasAuthority("super-admin")

                        // ADMIN-MODTUBE PERMISSION
                        .requestMatchers("/api/upload/**").hasAuthority("admin-modtube")
                        .requestMatchers(HttpMethod.PUT, "/api/videos/*").hasAuthority("admin-modtube")
                        .requestMatchers(HttpMethod.PATCH, "/api/videos/*").hasAuthority("admin-modtube")
                        .requestMatchers(HttpMethod.DELETE, "/api/videos/*").hasAuthority("admin-modtube")
                        .requestMatchers(HttpMethod.POST, "/api/videos/*/thumbnail").hasAuthority("admin-modtube")
                        .requestMatchers(HttpMethod.POST, "/api/videos/*/privacy").hasAuthority("admin-modtube")
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