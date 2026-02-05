package az.dev.localtube.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Unauthorized exception (403)
 */
@ResponseStatus(HttpStatus.FORBIDDEN)
public class UnauthorizedException extends RuntimeException {
    public UnauthorizedException(String message) {
        super(message);
    }
}