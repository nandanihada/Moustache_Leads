import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HelpCircle, X, CheckCircle2 } from 'lucide-react';
import { getApiBaseUrl } from '@/services/apiConfig';
import { useToast } from '@/hooks/use-toast';

const PollWidget = () => {
  const [poll, setPoll] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [closed, setClosed] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchActivePoll = async () => {
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/user/polls/active`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token') || localStorage.getItem('admin_token')}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.poll) {
            if (data.poll.has_voted) {
              setPoll(null); // Strictly hide if already answered
            } else {
              setPoll(data.poll);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch poll', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchActivePoll();
  }, []);

  const handleVote = async (optionId: string) => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/user/polls/${poll._id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || localStorage.getItem('admin_token')}`
        },
        body: JSON.stringify({ option_id: optionId })
      });
      
      if (!response.ok) throw new Error('Failed to vote');
      const data = await response.json();
      
      if (data.success) {
        setPoll({
          ...poll,
          has_voted: true,
          options: data.options,
          total_votes: data.total_votes
        });
        toast({ title: 'Vote recorded!', description: 'Thank you for your feedback.', duration: 2000 });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Could not record vote', variant: 'destructive' });
    }
  };

  const handleClose = () => {
    setClosed(true);
  };

  if (loading || closed || !poll) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 animate-in slide-in-from-bottom-5 fade-in duration-500">
      <Card className="border-purple-500/30 shadow-2xl shadow-purple-500/10 bg-background/95 backdrop-blur-sm overflow-hidden relative">
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute right-1 top-1 h-6 w-6 text-muted-foreground hover:text-foreground z-10"
          onClick={handleClose}
        >
          <X className="h-4 w-4" />
        </Button>
        
        {/* Glow accent */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-500"></div>

        <CardContent className="p-5 pt-6">
          <h4 className="font-bold mb-4 flex items-start gap-2 leading-tight pr-4">
            <HelpCircle className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
            {poll.question}
          </h4>

          {!poll.has_voted ? (
            <div className="flex gap-3">
              {poll.options.map((opt: any) => (
                <Button 
                  key={opt.id}
                  variant="outline" 
                  className={`flex-1 hover:text-white ${opt.id === 'yes' ? 'hover:bg-emerald-500 hover:border-emerald-500' : 'hover:bg-red-500 hover:border-red-500'}`}
                  onClick={() => handleVote(opt.id)}
                >
                  {opt.text}
                </Button>
              ))}
            </div>
          ) : (
            <div className="space-y-3 animate-in fade-in zoom-in-95 duration-300">
              {poll.options.map((opt: any) => {
                const percent = poll.total_votes > 0 ? Math.round((opt.votes / poll.total_votes) * 100) : 0;
                return (
                  <div key={opt.id} className="relative">
                    <div className="flex justify-between text-xs mb-1 font-medium z-10 relative px-2">
                      <span>{opt.text}</span>
                      <span>{percent}%</span>
                    </div>
                    <div className="h-6 bg-secondary/50 rounded-md overflow-hidden relative">
                      <div 
                        className={`absolute top-0 left-0 h-full transition-all duration-1000 ease-out ${opt.id === 'yes' ? 'bg-emerald-500/20 border-l-2 border-emerald-500' : 'bg-red-500/20 border-l-2 border-red-500'}`}
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
              <p className="text-center text-xs text-muted-foreground font-medium flex items-center justify-center gap-1 mt-2">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                Vote recorded
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PollWidget;
