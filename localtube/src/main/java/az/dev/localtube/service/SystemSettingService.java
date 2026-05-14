package az.dev.localtube.service;

import az.dev.localtube.entity.SystemSetting;
import az.dev.localtube.repository.SystemSettingRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Key-value config store backed by the system_settings table.
 * Values are cached in memory on startup and refreshed on every write.
 * Admin UI / API can update settings at runtime without a rebuild.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SystemSettingService {

    private final SystemSettingRepository repo;
    private final ConcurrentHashMap<String, String> cache = new ConcurrentHashMap<>();

    @PostConstruct
    public void loadAll() {
        repo.findAll().forEach(s -> {
            if (s.getValue() != null) cache.put(s.getKey(), s.getValue());
        });
        log.info("[Settings] Loaded {} system settings from DB", cache.size());
    }

    /** Returns the setting value, or {@code defaultValue} if not set. */
    public String get(String key, String defaultValue) {
        return cache.getOrDefault(key, defaultValue);
    }

    /** Returns all settings as a plain map (for the admin API). */
    public Map<String, Object> getAll() {
        List<SystemSetting> all = repo.findAll();
        return all.stream().collect(Collectors.toMap(
                SystemSetting::getKey,
                s -> Map.of(
                        "value",       s.getValue() != null ? s.getValue() : "",
                        "description", s.getDescription() != null ? s.getDescription() : "",
                        "updatedAt",   s.getUpdatedAt() != null ? s.getUpdatedAt().toString() : ""
                )
        ));
    }

    /** Persists one setting and updates the in-memory cache. */
    @Transactional
    public void set(String key, String value) {
        SystemSetting setting = repo.findById(key).orElseGet(() ->
                SystemSetting.builder().key(key).description("").build()
        );
        setting.setValue(value);
        setting.setUpdatedAt(LocalDateTime.now());
        repo.save(setting);
        if (value != null) cache.put(key, value);
        else cache.remove(key);
        log.info("[Settings] Updated: {}={}", key, value);
    }

    /** Bulk-update a map of key→value pairs. */
    @Transactional
    public void setAll(Map<String, String> updates) {
        updates.forEach(this::set);
    }
}
