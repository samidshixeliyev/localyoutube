package az.dev.modtube.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LoginResponse {

    private String email;
    private String name;
    private String fullName;
    private Long userId;
    private String accessToken;
    private String tokenType;
    private String role;
    private List<String> permissions;
}