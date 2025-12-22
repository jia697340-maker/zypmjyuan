// ===== 存储优化补丁 =====
// 将此代码添加到 script.js 中 dataStorage 初始化之后

// 存储监控和自动清理工具
class StorageMonitor {
    constructor(dataStorage) {
        this.dataStorage = dataStorage;
        this.maxStorageSize = 50 * 1024 * 1024; // 50MB 限制
        this.warningThreshold = 0.8; // 80% 警告阈值
    }

    // 计算当前存储大小
    async calculateStorageSize() {
        try {
            const estimate = await navigator.storage.estimate();
            const usage = estimate.usage || 0;
            const quota = estimate.quota || 0;
            
            console.log(`📊 存储使用情况: ${(usage / 1024 / 1024).toFixed(2)}MB / ${(quota / 1024 / 1024).toFixed(2)}MB`);
            
            return { usage, quota, percentage: usage / quota };
        } catch (error) {
            console.warn('无法获取存储信息:', error);
            return { usage: 0, quota: 0, percentage: 0 };
        }
    }

    // 检查并警告存储使用情况
    async checkStorage() {
        const { usage, quota, percentage } = await this.calculateStorageSize();
        
        if (percentage > this.warningThreshold) {
            console.warn(`⚠️ 存储空间不足！已使用 ${(percentage * 100).toFixed(1)}%`);
            return false;
        }
        
        return true;
    }

    // 清理未使用的图片
    async cleanupUnusedImages() {
        try {
            console.log('🧹 开始清理未使用的图片...');
            
            // 获取所有图片Blob
            const allImages = await this.dataStorage.db.imageBlobs.toArray();
            const allImageIds = new Set(allImages.map(img => img.id));
            
            // 获取所有使用中的图片ID
            const usedImageIds = new Set();
            
            // 从角色消息中收集
            const characters = await this.dataStorage.getData('章鱼喷墨机').then(data => data?.characters || []);
            for (const char of characters) {
                const messages = await this.dataStorage.getChatMessages(char.id, 'private');
                messages.forEach(msg => {
                    if (msg.image && msg.image.startsWith('blob:')) {
                        usedImageIds.add(msg.image.replace('blob:', ''));
                    }
                });
            }
            
            // 从群组消息中收集
            const groups = await this.dataStorage.getData('章鱼喷墨机').then(data => data?.groups || []);
            for (const group of groups) {
                const messages = await this.dataStorage.getChatMessages(group.id, 'group');
                messages.forEach(msg => {
                    if (msg.image && msg.image.startsWith('blob:')) {
                        usedImageIds.add(msg.image.replace('blob:', ''));
                    }
                });
            }
            
            // 找出未使用的图片
            const unusedImageIds = [...allImageIds].filter(id => !usedImageIds.has(id));
            
            if (unusedImageIds.length > 0) {
                await this.dataStorage.db.imageBlobs.bulkDelete(unusedImageIds);
                console.log(`✅ 已清理 ${unusedImageIds.length} 张未使用的图片`);
                return unusedImageIds.length;
            } else {
                console.log('✅ 没有需要清理的图片');
                return 0;
            }
        } catch (error) {
            console.error('清理图片时出错:', error);
            return 0;
        }
    }

    // 压缩旧消息（删除超过限制的历史消息）
    async compressOldMessages(maxMessagesPerChat = 500) {
        try {
            console.log('🗜️ 开始压缩旧消息...');
            let totalDeleted = 0;
            
            // 压缩角色消息
            const characters = await this.dataStorage.getData('章鱼喷墨机').then(data => data?.characters || []);
            for (const char of characters) {
                const messages = await this.dataStorage.getChatMessages(char.id, 'private');
                if (messages.length > maxMessagesPerChat) {
                    const keepMessages = messages.slice(-maxMessagesPerChat);
                    await this.dataStorage.saveChatMessages(char.id, 'private', keepMessages);
                    totalDeleted += messages.length - maxMessagesPerChat;
                }
            }
            
            // 压缩群组消息
            const groups = await this.dataStorage.getData('章鱼喷墨机').then(data => data?.groups || []);
            for (const group of groups) {
                const messages = await this.dataStorage.getChatMessages(group.id, 'group');
                if (messages.length > maxMessagesPerChat) {
                    const keepMessages = messages.slice(-maxMessagesPerChat);
                    await this.dataStorage.saveChatMessages(group.id, 'group', keepMessages);
                    totalDeleted += messages.length - maxMessagesPerChat;
                }
            }
            
            if (totalDeleted > 0) {
                console.log(`✅ 已压缩 ${totalDeleted} 条旧消息`);
            } else {
                console.log('✅ 没有需要压缩的消息');
            }
            
            return totalDeleted;
        } catch (error) {
            console.error('压缩消息时出错:', error);
            return 0;
        }
    }

    // 完整清理流程
    async performFullCleanup() {
        console.log('🚀 开始完整清理流程...');
        
        const beforeSize = await this.calculateStorageSize();
        
        // 1. 清理未使用的图片
        const deletedImages = await this.cleanupUnusedImages();
        
        // 2. 压缩旧消息
        const deletedMessages = await this.compressOldMessages();
        
        const afterSize = await this.calculateStorageSize();
        const savedSpace = beforeSize.usage - afterSize.usage;
        
        console.log(`✅ 清理完成！释放了 ${(savedSpace / 1024 / 1024).toFixed(2)}MB 空间`);
        console.log(`   - 删除图片: ${deletedImages} 张`);
        console.log(`   - 压缩消息: ${deletedMessages} 条`);
        
        return { deletedImages, deletedMessages, savedSpace };
    }
}

// 使用方法：
// 1. 在 dataStorage 初始化后添加：
//    const storageMonitor = new StorageMonitor(dataStorage);
//
// 2. 定期检查存储（例如每次保存数据后）：
//    await storageMonitor.checkStorage();
//
// 3. 手动触发清理：
//    await storageMonitor.performFullCleanup();
//
// 4. 自动清理（每小时检查一次）：
//    setInterval(async () => {
//        const isOk = await storageMonitor.checkStorage();
//        if (!isOk) {
//            await storageMonitor.performFullCleanup();
//        }
//    }, 60 * 60 * 1000);
