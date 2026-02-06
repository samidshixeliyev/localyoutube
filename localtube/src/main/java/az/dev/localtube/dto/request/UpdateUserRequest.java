package az.dev.localtube.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateUserRequest {

    @Size(max = 100, message = "Name must be less than 100 characters")
    private String name;

    @Size(max = 100, message = "Surname must be less than 100 characters")
    private String surname;

    @Email(message = "Email must be valid")
    private String email;

    private Long roleId;
}