package com.noteforge.note.service;

import com.noteforge.note.dto.SyncPushRequest;
import com.noteforge.note.dto.SyncStateResponse;
import com.noteforge.note.entity.SyncLogEntity;
import com.noteforge.note.repository.SyncLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SyncService {

    private final SyncLogRepository syncLogRepository;

    public SyncStateResponse getSyncState(String userId) {
        List<SyncLogEntity> logs = syncLogRepository
                .findByUserIdAndVersionGreaterThanOrderByVersionAsc(userId, 0L);
        long lastVersion = logs.stream().mapToLong(SyncLogEntity::getVersion).max().orElse(0);
        return new SyncStateResponse(lastVersion, 0, 0);
    }

    public List<SyncLogEntity> pullChanges(String userId, long lastVersion) {
        return syncLogRepository.findByUserIdAndVersionGreaterThanOrderByVersionAsc(userId, lastVersion);
    }

    public void pushChanges(String userId, SyncPushRequest request) {
        for (SyncPushRequest.SyncChangeItem item : request.getChanges()) {
            SyncLogEntity log = new SyncLogEntity();
            log.setNoteId(item.getNoteId());
            log.setUserId(userId);
            log.setOperation(item.getOperation());
            log.setSnapshot(item.getSnapshot());
            log.setVersion(item.getClientVersion());
            syncLogRepository.save(log);
        }
    }

    public long getCurrentVersion(String userId) {
        List<SyncLogEntity> logs = syncLogRepository
                .findByUserIdAndVersionGreaterThanOrderByVersionAsc(userId, 0L);
        return logs.stream().mapToLong(SyncLogEntity::getVersion).max().orElse(0);
    }
}
