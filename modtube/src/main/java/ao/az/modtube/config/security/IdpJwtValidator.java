package ao.az.modtube.config.security;

import ao.az.modtube.service.SystemSettingService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import javax.net.ssl.*;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;

/**
 * Validates RS256 JWTs issued by AO ID (auth.ao.az) using the JWKS endpoint.
 *
 * Claim names used to extract email / display-name are read from the
 * system_settings table at call time, so admins can reconfigure them
 * via the IDP Settings page without rebuilding the container.
 *
 * NOTE: The JWKS URI itself is fixed at startup (used to build the decoder).
 *       Changing it requires a container restart.
 */
@Slf4j
@Component
public class IdpJwtValidator {

    private final JwtDecoder decoder;
    private final SystemSettingService settings;

    public IdpJwtValidator(
            @Value("${modtube.idp.jwks-uri}") String jwksUri,
            @Value("${modtube.idp.skip-ssl-verify:true}") boolean skipSslVerify,
            SystemSettingService settings) {

        this.settings = settings;

        NimbusJwtDecoder.JwkSetUriJwtDecoderBuilder builder =
                NimbusJwtDecoder.withJwkSetUri(jwksUri);

        if (skipSslVerify) {
            builder.restOperations(buildRestTemplate(true));
            log.warn("IdpJwtValidator: SSL certificate verification DISABLED (skip-ssl-verify=true)");
        } else {
            // Still set short timeouts so an offline/unreachable IDP does not block requests
            builder.restOperations(buildRestTemplate(false));
        }

        this.decoder = builder.build();
        log.info("IdpJwtValidator initialized with JWKS URI: {}", jwksUri);
    }

    public Jwt validate(String token) {
        try {
            return decoder.decode(token);
        } catch (JwtException e) {
            log.debug("IDP JWT validation failed: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Extracts email and display name from the decoded JWT using the
     * claim names configured in system_settings (defaults: mail, cn, givenName, sn, uid).
     */
    public OidcUserDetails toUserDetails(Jwt jwt) {
        // Read claim names from DB — zero-cost cache lookup, changes take effect immediately
        String emailClaim    = settings.get("idp.claim.email",    "mail");
        String fullNameClaim = settings.get("idp.claim.fullname", "cn");
        String firstClaim    = settings.get("idp.claim.first",    "givenName");
        String lastClaim     = settings.get("idp.claim.last",     "sn");
        String usernameClaim = settings.get("idp.claim.username", "uid");

        String email = firstNonNull(
                jwt.getClaimAsString(emailClaim),
                jwt.getClaimAsString("email"),      // OIDC standard fallback
                jwt.getSubject()
        );

        String displayName = firstNonNull(
                jwt.getClaimAsString(fullNameClaim),
                buildFullName(jwt.getClaimAsString(firstClaim), jwt.getClaimAsString(lastClaim)),
                jwt.getClaimAsString(usernameClaim),
                jwt.getClaimAsString("preferred_username")
        );

        log.debug("IDP claims — {}(email)={} {}(fullName)={} {}={} {}={} {}={}",
                emailClaim,    jwt.getClaimAsString(emailClaim),
                fullNameClaim, jwt.getClaimAsString(fullNameClaim),
                firstClaim,    jwt.getClaimAsString(firstClaim),
                lastClaim,     jwt.getClaimAsString(lastClaim),
                usernameClaim, jwt.getClaimAsString(usernameClaim));

        return new OidcUserDetails(email, displayName, jwt.getSubject());
    }

    private static String firstNonNull(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }

    private static String buildFullName(String given, String sn) {
        if (given == null && sn == null) return null;
        if (sn == null) return given;
        if (given == null) return sn;
        return given + " " + sn;
    }

    private static RestTemplate buildRestTemplate(boolean skipSsl) {
        try {
            SimpleClientHttpRequestFactory factory;

            if (skipSsl) {
                SSLContext sslContext = SSLContext.getInstance("TLS");
                sslContext.init(null, new TrustManager[]{new X509TrustManager() {
                    public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
                    public void checkClientTrusted(X509Certificate[] c, String a) {}
                    public void checkServerTrusted(X509Certificate[] c, String a) {}
                }}, new SecureRandom());

                SSLSocketFactory sf = sslContext.getSocketFactory();
                HostnameVerifier hv = (host, session) -> true;

                factory = new SimpleClientHttpRequestFactory() {
                    @Override
                    protected void prepareConnection(java.net.HttpURLConnection conn, String method)
                            throws java.io.IOException {
                        if (conn instanceof HttpsURLConnection https) {
                            https.setSSLSocketFactory(sf);
                            https.setHostnameVerifier(hv);
                        }
                        super.prepareConnection(conn, method);
                    }
                };
            } else {
                factory = new SimpleClientHttpRequestFactory();
            }

            // Short timeouts so an offline/unreachable IDP never stalls a request thread
            factory.setConnectTimeout(3_000);
            factory.setReadTimeout(5_000);

            return new RestTemplate(factory);
        } catch (Exception e) {
            throw new RuntimeException("Failed to build RestTemplate for IdpJwtValidator", e);
        }
    }
}
