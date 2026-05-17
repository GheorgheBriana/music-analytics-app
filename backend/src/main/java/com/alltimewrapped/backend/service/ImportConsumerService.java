package com.alltimewrapped.backend.service;

import com.alltimewrapped.backend.config.RabbitMQConfig;
import com.alltimewrapped.backend.dto.ImportBatchMessage;
import com.alltimewrapped.backend.model.AppUser;
import com.alltimewrapped.backend.repository.AppUserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class ImportConsumerService {

    private final ImportService importService;
    private final AppUserRepository appUserRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final GenreSyncService genreSyncService;

    //@RabbitListener(queues = RabbitMQConfig.IMPORT_QUEUE)
    public void receiveBatch(ImportBatchMessage message) {
        log.info("Received batch {}/{} for user {}", message.getBatchIndex() + 1, message.getTotalBatches(), message.getUserId());

        Optional<AppUser> userOpt = appUserRepository.findById(message.getUserId());
        if (userOpt.isEmpty()) {
            log.error("User {} not found, cannot process batch", message.getUserId());
            return;
        }

        importService.processRecords(message.getRecords(), userOpt.get());

        // Calculate progress percentage
        int progress = (int) (((double) (message.getBatchIndex() + 1) / message.getTotalBatches()) * 100);
        
        // Send WebSocket notification
        messagingTemplate.convertAndSend(
                "/topic/import-progress/" + message.getUserId(),
                "{\"progress\": " + progress + ", \"message\": \"Procesare date...\"}"
        );
        
        if (progress == 100) {
             messagingTemplate.convertAndSend(
                "/topic/import-progress/" + message.getUserId(),
                "{\"progress\": 100, \"status\": \"COMPLETED\"}"
            );
            
            // Trigger background genre sync from Last.fm
            genreSyncService.syncGenresAsync();
        }
        
        log.info("Processed batch {}/{}. Progress: {}%", message.getBatchIndex() + 1, message.getTotalBatches(), progress);
    }
}
