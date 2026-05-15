package ao.az.modtube.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class UpdateRoleRequest {

    @Size(max = 100, message = "Role name must be less than 100 characters")
    private String name;

    @Size(max = 500, message = "Description must be less than 500 characters")
    private String description;

    /** Full replacement list of permission IDs. Null = do not change permissions. */
    private List<Long> permissionIds;
}
