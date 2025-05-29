const logger = require('../utils/logger');
const ValidationUtils = require('../utils/validation');

class AirdropManager {
    constructor(database, walletManager, telegramBot) {
        this.db = database;
        this.wallet = walletManager;
        this.bot = telegramBot;
        this.logger = logger;
        this.isRunning = false;
        this.checkInterval = 60000; // Check every minute
    }

    async start() {
        if (this.isRunning) {
            this.logger.warn('Airdrop manager is already running');
            return;
        }

        this.isRunning = true;
        this.logger.info('Starting airdrop manager...');

        // Start the airdrop checker
        this.checkAirdrops();
    }

    async stop() {
        this.isRunning = false;
        this.logger.info('Stopping airdrop manager...');
    }

    async checkAirdrops() {
        const checker = async () => {
            if (!this.isRunning) return;

            try {
                await this.processExpiredAirdrops();
            } catch (error) {
                this.logger.error('Airdrop check error:', error);
            }

            // Schedule next check
            if (this.isRunning) {
                setTimeout(checker, this.checkInterval);
            }
        };

        // Start checking
        checker();
    }

    async processExpiredAirdrops() {
        try {
            // Get expired airdrops that are still active
            const expiredAirdrops = await this.db.all(`
                SELECT * FROM airdrops 
                WHERE status = 'active' 
                AND expires_at <= datetime('now')
            `);

            for (const airdrop of expiredAirdrops) {
                await this.completeAirdrop(airdrop);
            }

        } catch (error) {
            this.logger.error('Process expired airdrops error:', error);
        }
    }

    async completeAirdrop(airdrop) {
        try {
            this.logger.info(`Completing airdrop ${airdrop.id}...`);

            // Get all participants
            const participants = await this.db.getAirdropParticipants(airdrop.id);

            if (participants.length === 0) {
                // No participants - refund creator
                await this.refundAirdrop(airdrop);
                return;
            }

            // Calculate amount per participant
            const amountPerParticipant = airdrop.total_amount / participants.length;

            if (amountPerParticipant < 0.00000001) {
                this.logger.warn(`Airdrop ${airdrop.id} amount too small to distribute`);
                await this.refundAirdrop(airdrop);
                return;
            }

            // Get creator user
            const creator = await this.db.get('SELECT * FROM users WHERE id = ?', [airdrop.creator_user_id]);
            if (!creator) {
                this.logger.error(`Airdrop creator not found for airdrop ${airdrop.id}`);
                return;
            }

            // Check creator balance
            const creatorBalance = await this.db.getUserBalance(creator.id, airdrop.coin_symbol);
            if (creatorBalance.confirmed_balance < airdrop.total_amount) {
                this.logger.error(`Insufficient balance for airdrop ${airdrop.id}`);
                await this.cancelAirdrop(airdrop, 'Insufficient balance');
                return;
            }

            // Start database transaction
            await this.db.beginTransaction();

            try {
                // Deduct total amount from creator
                const newCreatorBalance = creatorBalance.confirmed_balance - airdrop.total_amount;
                await this.db.updateBalance(
                    creator.id,
                    airdrop.coin_symbol,
                    newCreatorBalance,
                    creatorBalance.unconfirmed_balance
                );

                // Distribute to participants
                let successfulDistributions = 0;
                const distributionResults = [];

                for (const participant of participants) {
                    try {
                        // Get participant balance
                        const participantBalance = await this.db.getUserBalance(
                            participant.user_id,
                            airdrop.coin_symbol
                        );

                        // Add airdrop amount
                        const newParticipantBalance = participantBalance.confirmed_balance + amountPerParticipant;
                        await this.db.updateBalance(
                            participant.user_id,
                            airdrop.coin_symbol,
                            newParticipantBalance,
                            participantBalance.unconfirmed_balance
                        );

                        // Record transaction
                        await this.db.createTransaction({
                            txid: null, // Internal transfer
                            fromUserId: creator.id,
                            toUserId: participant.user_id,
                            coinSymbol: airdrop.coin_symbol,
                            amount: amountPerParticipant,
                            fee: 0,
                            transactionType: 'airdrop',
                            status: 'confirmed',
                            telegramMessageId: airdrop.telegram_message_id,
                            groupId: airdrop.group_id
                        });

                        successfulDistributions++;
                        distributionResults.push({
                            telegramId: participant.telegram_id,
                            username: participant.username,
                            amount: amountPerParticipant,
                            success: true
                        });

                    } catch (error) {
                        this.logger.error(`Failed to distribute to participant ${participant.user_id}:`, error);
                        distributionResults.push({
                            telegramId: participant.telegram_id,
                            username: participant.username,
                            amount: amountPerParticipant,
                            success: false,
                            error: error.message
                        });
                    }
                }

                // Mark airdrop as completed
                await this.db.completeAirdrop(airdrop.id);

                await this.db.commit();

                // Send completion message
                await this.sendAirdropCompletionMessage(airdrop, distributionResults, successfulDistributions);

                this.logger.info(`Airdrop ${airdrop.id} completed successfully:`, {
                    participants: participants.length,
                    successful: successfulDistributions,
                    amountPerParticipant,
                    totalAmount: airdrop.total_amount,
                    coin: airdrop.coin_symbol
                });

            } catch (error) {
                await this.db.rollback();
                throw error;
            }

        } catch (error) {
            this.logger.error(`Airdrop completion error for airdrop ${airdrop.id}:`, error);
            await this.cancelAirdrop(airdrop, 'Processing error');
        }
    }

    async refundAirdrop(airdrop) {
        try {
            this.logger.info(`Refunding airdrop ${airdrop.id} (no participants)`);

            // Mark as completed (no distribution needed)
            await this.db.completeAirdrop(airdrop.id);

            // Send refund message
            const creatorName = await this.getCreatorName(airdrop.creator_user_id);
            const message = `🎁 Airdrop Completed\n\n` +
                `❌ No participants joined the airdrop.\n` +
                `💰 ${ValidationUtils.formatAmount(airdrop.total_amount)} ${airdrop.coin_symbol} remains with ${creatorName}.`;

            if (this.bot && this.bot.bot) {
                try {
                    await this.bot.bot.editMessageText(message, {
                        chat_id: airdrop.group_id,
                        message_id: airdrop.telegram_message_id
                    });
                } catch (error) {
                    // Message might be too old to edit
                    await this.bot.bot.sendMessage(airdrop.group_id, message);
                }
            }

        } catch (error) {
            this.logger.error(`Airdrop refund error for airdrop ${airdrop.id}:`, error);
        }
    }

    async cancelAirdrop(airdrop, reason) {
        try {
            this.logger.info(`Cancelling airdrop ${airdrop.id}: ${reason}`);

            // Update airdrop status
            await this.db.run(
                'UPDATE airdrops SET status = "cancelled" WHERE id = ?',
                [airdrop.id]
            );

            // Send cancellation message
            const creatorName = await this.getCreatorName(airdrop.creator_user_id);
            const message = `🎁 Airdrop Cancelled\n\n` +
                `❌ Reason: ${reason}\n` +
                `💰 ${ValidationUtils.formatAmount(airdrop.total_amount)} ${airdrop.coin_symbol} remains with ${creatorName}.`;

            if (this.bot && this.bot.bot) {
                try {
                    await this.bot.bot.editMessageText(message, {
                        chat_id: airdrop.group_id,
                        message_id: airdrop.telegram_message_id
                    });
                } catch (error) {
                    // Message might be too old to edit
                    await this.bot.bot.sendMessage(airdrop.group_id, message);
                }
            }

        } catch (error) {
            this.logger.error(`Airdrop cancellation error for airdrop ${airdrop.id}:`, error);
        }
    }

    async sendAirdropCompletionMessage(airdrop, distributionResults, successfulDistributions) {
        try {
            const creatorName = await this.getCreatorName(airdrop.creator_user_id);
            const amountPerParticipant = airdrop.total_amount / distributionResults.length;

            let message = `🎁 Airdrop Completed! 🎉\n\n`;
            message += `👤 Creator: ${creatorName}\n`;
            message += `💰 Total: ${ValidationUtils.formatAmount(airdrop.total_amount)} ${airdrop.coin_symbol}\n`;
            message += `👥 Participants: ${distributionResults.length}\n`;
            message += `✅ Successful: ${successfulDistributions}\n`;
            message += `💸 Each received: ${ValidationUtils.formatAmount(amountPerParticipant)} ${airdrop.coin_symbol}\n\n`;

            // Add participant list (limited to avoid message length issues)
            const maxParticipantsToShow = 10;
            const successfulParticipants = distributionResults.filter(p => p.success);
            
            if (successfulParticipants.length > 0) {
                message += `🎉 Winners:\n`;
                
                for (let i = 0; i < Math.min(successfulParticipants.length, maxParticipantsToShow); i++) {
                    const participant = successfulParticipants[i];
                    const name = participant.username || `User${participant.telegramId}`;
                    message += `• ${name}\n`;
                }

                if (successfulParticipants.length > maxParticipantsToShow) {
                    message += `• ... and ${successfulParticipants.length - maxParticipantsToShow} more!\n`;
                }
            }

            if (this.bot && this.bot.bot) {
                try {
                    await this.bot.bot.editMessageText(message, {
                        chat_id: airdrop.group_id,
                        message_id: airdrop.telegram_message_id
                    });
                } catch (error) {
                    // Message might be too old to edit
                    await this.bot.bot.sendMessage(airdrop.group_id, message);
                }
            }

            // Send private notifications to winners
            for (const participant of successfulParticipants) {
                try {
                    if (this.bot && this.bot.bot) {
                        await this.bot.bot.sendMessage(participant.telegramId,
                            `🎉 Congratulations! You won ${ValidationUtils.formatAmount(amountPerParticipant)} ${airdrop.coin_symbol} from the airdrop by ${creatorName}!`
                        );
                    }
                } catch (error) {
                    // User might have blocked the bot
                    this.logger.debug(`Could not notify airdrop winner ${participant.telegramId}:`, error.message);
                }
            }

        } catch (error) {
            this.logger.error('Failed to send airdrop completion message:', error);
        }
    }

    async getCreatorName(creatorUserId) {
        try {
            const creator = await this.db.get('SELECT * FROM users WHERE id = ?', [creatorUserId]);
            return creator ? (creator.username || creator.first_name || `User${creator.telegram_id}`) : 'Unknown';
        } catch (error) {
            return 'Unknown';
        }
    }

    // Get active airdrops statistics
    async getAirdropStats() {
        try {
            const stats = {};

            // Active airdrops
            const activeAirdrops = await this.db.all(`
                SELECT * FROM airdrops 
                WHERE status = 'active' 
                AND expires_at > datetime('now')
            `);

            stats.active = activeAirdrops.length;

            // Completed airdrops (last 24 hours)
            const completedAirdrops = await this.db.all(`
                SELECT * FROM airdrops 
                WHERE status = 'completed' 
                AND completed_at > datetime('now', '-1 day')
            `);

            stats.completedToday = completedAirdrops.length;

            // Total participants in active airdrops
            let totalParticipants = 0;
            for (const airdrop of activeAirdrops) {
                const participants = await this.db.getAirdropParticipants(airdrop.id);
                totalParticipants += participants.length;
            }

            stats.totalActiveParticipants = totalParticipants;

            // Upcoming expirations (next hour)
            const upcomingExpirations = await this.db.all(`
                SELECT * FROM airdrops 
                WHERE status = 'active' 
                AND expires_at <= datetime('now', '+1 hour')
                AND expires_at > datetime('now')
            `);

            stats.expiringWithinHour = upcomingExpirations.length;

            return stats;

        } catch (error) {
            this.logger.error('Failed to get airdrop stats:', error);
            throw error;
        }
    }

    // Manually complete an airdrop (admin function)
    async manuallyCompleteAirdrop(airdropId) {
        try {
            const airdrop = await this.db.get('SELECT * FROM airdrops WHERE id = ?', [airdropId]);
            
            if (!airdrop) {
                throw new Error('Airdrop not found');
            }

            if (airdrop.status !== 'active') {
                throw new Error('Airdrop is not active');
            }

            await this.completeAirdrop(airdrop);
            this.logger.info(`Manually completed airdrop ${airdropId}`);

        } catch (error) {
            this.logger.error(`Manual airdrop completion error for ${airdropId}:`, error);
            throw error;
        }
    }

    // Cancel an airdrop (admin function)
    async manuallyCancelAirdrop(airdropId, reason = 'Manually cancelled') {
        try {
            const airdrop = await this.db.get('SELECT * FROM airdrops WHERE id = ?', [airdropId]);
            
            if (!airdrop) {
                throw new Error('Airdrop not found');
            }

            if (airdrop.status !== 'active') {
                throw new Error('Airdrop is not active');
            }

            await this.cancelAirdrop(airdrop, reason);
            this.logger.info(`Manually cancelled airdrop ${airdropId}: ${reason}`);

        } catch (error) {
            this.logger.error(`Manual airdrop cancellation error for ${airdropId}:`, error);
            throw error;
        }
    }
}

module.exports = AirdropManager;