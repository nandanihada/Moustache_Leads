export type QueueStatus = 'queued' | 'sending' | 'sent' | 'skipped' | 'removed';

export interface OfferQueueItem {
  id: string;
  userId: string;
  username: string;
  offerId?: string;
  offerIds?: string[];
  offerName: string;
  scheduledTime: number; // timestamp
  status: QueueStatus;
  sendMode: 'single' | 'combined';
  addedAt: number;
  isUrgent?: boolean;
  isPaused?: boolean;
  ip?: string;
  city?: string;
  country?: string;
}

class OfferQueueService {
  private queue: OfferQueueItem[] = [];
  private isProcessing = false;
  private pausedUsers: Set<string> = new Set();
  private timer: any = null;
  private listeners: ((queue: OfferQueueItem[]) => void)[] = [];
  
  constructor() {
    this.load();
    this.startProcessing();
  }

  private load() {
    try {
      const stored = localStorage.getItem('offer_live_queue');
      if (stored) {
        this.queue = JSON.parse(stored);
      }
      const storedPaused = localStorage.getItem('offer_paused_users');
      if (storedPaused) {
        this.pausedUsers = new Set(JSON.parse(storedPaused));
      }
    } catch (e) {
      console.error('Failed to load offer queue', e);
    }
  }

  private save() {
    localStorage.setItem('offer_live_queue', JSON.stringify(this.queue));
    localStorage.setItem('offer_paused_users', JSON.stringify(Array.from(this.pausedUsers)));
    this.notify();
  }

  private notify() {
    this.listeners.forEach(fn => fn([...this.queue]));
  }

  subscribe(fn: (queue: OfferQueueItem[]) => void) {
    this.listeners.push(fn);
    fn([...this.queue]);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  getQueue() {
    return [...this.queue];
  }

  addItems(items: Omit<OfferQueueItem, 'id' | 'status' | 'addedAt'>[]) {
    const newItems = items.map(item => ({
      ...item,
      id: Math.random().toString(36).substring(2, 9),
      status: 'queued' as QueueStatus,
      addedAt: Date.now()
    }));
    this.queue = [...this.queue, ...newItems];
    this.save();
  }

  updateItemTime(id: string, newTime: number) {
    const item = this.queue.find(q => q.id === id);
    if (item && item.status === 'queued') {
      item.scheduledTime = newTime;
      this.save();
    }
  }

  updateItemStatus(id: string, status: QueueStatus) {
    const item = this.queue.find(q => q.id === id);
    if (item) {
      item.status = status;
      this.save();
    }
  }

  removeItemsForUser(userId: string) {
    this.queue.forEach(q => {
      if (q.userId === userId) {
        q.status = 'removed';
      }
    });
    this.save();
  }

  removeItem(id: string) {
    const item = this.queue.find(q => q.id === id);
    if (item) {
      item.status = 'removed';
      this.save();
    }
  }

  clearQueue() {
    this.queue = [];
    this.save();
  }

  resendItem(id: string, customTime?: number) {
    const original = this.queue.find(q => q.id === id);
    if (original) {
      const newItem: OfferQueueItem = {
        ...original,
        id: Math.random().toString(36).substring(2, 9),
        status: 'queued',
        scheduledTime: customTime || Date.now(),
        addedAt: Date.now()
      };
      this.queue.push(newItem);
      this.save();
    }
  }

  markUrgent(id: string) {
    const item = this.queue.find(q => q.id === id);
    if (item && item.status === 'queued') {
      item.isUrgent = true;
      // Move to top of queued items
      const now = Date.now();
      item.scheduledTime = now;
      this.recalculateAllPending(now, 2); // Recalculates, putting urgent items first
    }
  }

  toggleUserPause(userId: string) {
    if (this.pausedUsers.has(userId)) {
      this.pausedUsers.delete(userId);
    } else {
      this.pausedUsers.add(userId);
    }
    // Also sync existing queued items for backward compatibility/UI clarity
    this.queue.forEach(q => {
      if (q.userId === userId && q.status === 'queued') {
        q.isPaused = this.pausedUsers.has(userId);
      }
    });
    this.save();
  }

  isUserPaused(userId: string) {
    return this.pausedUsers.has(userId);
  }

  getNextItemForUser(userId: string) {
    return this.queue.find(q => q.userId === userId && q.status === 'queued');
  }

  skipNextForUser(userId: string) {
    const next = this.getNextItemForUser(userId);
    if (next) {
      this.updateItemStatus(next.id, 'skipped');
    }
  }
  
  pauseQueue() {
    this.isProcessing = false;
    this.notify();
  }
  
  resumeQueue() {
    this.isProcessing = true;
    this.notify();
  }
  
  getIsProcessing() {
    return this.isProcessing;
  }

  recalculateTimes(userId: string | null, startTime: number, intervalMinutes: number) {
    let items = this.queue.filter(q => q.status === 'queued');
    if (userId) {
      items = items.filter(q => q.userId === userId);
    }
    items.sort((a, b) => a.addedAt - b.addedAt);
      
    items.forEach((item, index) => {
      item.scheduledTime = startTime + (index * intervalMinutes * 60000);
    });
    this.save();
  }

  recalculateAllPending(startTime: number, intervalMinutes: number) {
    let items = this.queue.filter(q => q.status === 'queued');
    items.sort((a, b) => a.scheduledTime - b.scheduledTime);
    items.forEach((item, index) => {
      item.scheduledTime = startTime + (index * intervalMinutes * 60000);
    });
    this.save();
  }

  private startProcessing() {
    this.isProcessing = true;
    this.timer = setInterval(async () => {
      if (!this.isProcessing) return;
      
      const now = Date.now();
      const toProcess = this.queue.find(q => q.status === 'queued' && !q.isPaused && q.scheduledTime <= now);
      
      if (toProcess) {
        toProcess.status = 'sending';
        this.save();
        
        try {
          const token = localStorage.getItem('token');
          const payload: any = {
            user_ids: [toProcess.userId],
            offer_ids: toProcess.sendMode === 'combined' ? toProcess.offerIds : [toProcess.offerId],
            send_via: 'email',
            template_type: 'recommend',
            subject: `Recommended Offer: ${toProcess.offerName} - Moustache Leads`
          };
          
          const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
          const res = await fetch(`${API_BASE_URL}/api/admin/offer-access-requests/send-offers`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
          });
          
          if (res.ok) {
            toProcess.status = 'sent';
            window.dispatchEvent(new CustomEvent('offer_queue_sent', {
              detail: toProcess
            }));
          } else {
            toProcess.status = 'skipped';
          }
        } catch (e) {
          console.error('Failed to send from queue', e);
          toProcess.status = 'skipped';
        }
        
        this.save();
      }
    }, 5000);
  }
}

export const offerQueueService = new OfferQueueService();
