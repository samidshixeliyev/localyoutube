package az.dev.localtube.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Insufficient storage exception (507)
 */
@ResponseStatus(HttpStatus.INSUFFICIENT_STORAGE)
public class InsufficientStorageException extends RuntimeException {
    public InsufficientStorageException(String message) {
        super(message);
    }
}