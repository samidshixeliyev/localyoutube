package az.dev.localtube.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Permission entity - stored in MSSQL
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "permissions", schema = "dbo")
public class Permission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true, length = 100)
    private String name;
    
    @Column(length = 255)
    private String description;
    
    // Common permission names as constants
    public static final String VIDEO_UPLOAD = "VIDEO_UPLOAD";
    public static final String VIDEO_DELETE = "VIDEO_DELETE";
    public static final String VIDEO_UPDATE = "VIDEO_UPDATE";
    public static final String COMMENT_CREATE = "COMMENT_CREATE";
    public static final String COMMENT_DELETE = "COMMENT_DELETE";
    public static final String VIDEO_LIKE = "VIDEO_LIKE";
    public static final String ADMIN_ACCESS = "ADMIN_ACCESS";
    public static final String ADMIN_DELETE_ANY = "ADMIN_DELETE_ANY";
    public static final String ADMIN_VIEW_STATS = "ADMIN_VIEW_STATS";
}