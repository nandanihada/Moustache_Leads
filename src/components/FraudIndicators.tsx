import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, Clock, Activity } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface VPNDetection {
    is_vpn?: boolean;
    is_proxy?: boolean;
    is_tor?: boolean;
    is_datacenter?: boolean;
    provider?: string;
    confidence?: string;
}

interface SessionFrequency {
    logins_last_hour?: number;
    logins_last_day?: number;
    risk_level?: string;
}

interface FraudIndicatorsProps {
    vpnDetection?: VPNDetection;
    deviceChange?: boolean;
    sessionFrequency?: SessionFrequency;
    fraudScore?: number;
    riskLevel?: string;
    compact?: boolean;
}

export const FraudIndicators: React.FC<FraudIndicatorsProps> = ({
    vpnDetection,
    deviceChange,
    sessionFrequency,
    fraudScore = 0,
    riskLevel = 'low',
    compact = false
}) => {
    const getRiskColor = (score: number) => {
        if (score >= 76) return 'bg-red-500';
        if (score >= 51) return 'bg-orange-500';
        if (score >= 26) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    const getRiskBadgeVariant = (level: string) => {
        if (level === 'critical') return 'destructive';
        if (level === 'high') return 'destructive';
        if (level === 'medium') return 'default';
        return 'secondary';
    };

    // Don't show anything if no fraud indicators
    const hasIndicators = vpnDetection?.is_vpn ||
        vpnDetection?.is_proxy ||
        vpnDetection?.is_tor ||
        deviceChange ||
        (sessionFrequency?.risk_level && sessionFrequency.risk_level !== 'low');

    if (!hasIndicators && fraudScore === 0) {
        return null;
    }

    if (compact) {
        return (
            <div className="flex items-center gap-2">
                {/* Fraud Score Indicator */}
                {fraudScore > 0 && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <div className="flex items-center gap-1">
                                    <div className={`w-2 h-2 rounded-full ${getRiskColor(fraudScore)}`} />
                                    <span className="text-xs text-muted-foreground">{fraudScore}</span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Fraud Score: {fraudScore}/100</p>
                                <p>Risk Level: {riskLevel}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                {/* VPN Badge */}
                {vpnDetection?.is_vpn && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <Badge variant="destructive" className="text-xs">
                                    <Shield className="h-3 w-3" />
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>VPN Detected</p>
                                {vpnDetection.provider && <p>Provider: {vpnDetection.provider}</p>}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                {/* Device Change Badge */}
                {deviceChange && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <Badge variant="default" className="text-xs bg-yellow-500 hover:bg-yellow-600">
                                    <AlertTriangle className="h-3 w-3" />
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>New Device Detected</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                {/* Session Frequency Badge */}
                {sessionFrequency?.risk_level && sessionFrequency.risk_level !== 'low' && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <Badge
                                    variant={sessionFrequency.risk_level === 'high' ? 'destructive' : 'default'}
                                    className="text-xs"
                                >
                                    <Clock className="h-3 w-3" />
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{sessionFrequency.logins_last_hour} logins in last hour</p>
                                <p>Risk: {sessionFrequency.risk_level}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>
        );
    }

    // Full display mode
    return (
        <div className="flex flex-wrap items-center gap-2">
            {/* Fraud Score */}
            {fraudScore > 0 && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-muted">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${getRiskColor(fraudScore)}`} />
                        <span className="text-sm font-medium">Risk: {fraudScore}/100</span>
                        <Badge variant={getRiskBadgeVariant(riskLevel)} className="text-xs">
                            {riskLevel.toUpperCase()}
                        </Badge>
                    </div>
                </div>
            )}

            {/* VPN Detection */}
            {vpnDetection?.is_vpn && (
                <Badge variant="destructive">
                    <Shield className="h-3 w-3 mr-1" />
                    VPN Detected
                    {vpnDetection.provider && ` (${vpnDetection.provider})`}
                </Badge>
            )}

            {/* Proxy Detection */}
            {vpnDetection?.is_proxy && !vpnDetection.is_vpn && (
                <Badge variant="destructive">
                    <Shield className="h-3 w-3 mr-1" />
                    Proxy Detected
                </Badge>
            )}

            {/* Tor Detection */}
            {vpnDetection?.is_tor && (
                <Badge variant="destructive">
                    <Shield className="h-3 w-3 mr-1" />
                    Tor Network
                </Badge>
            )}

            {/* Datacenter IP */}
            {vpnDetection?.is_datacenter && (
                <Badge variant="default" className="bg-orange-500 hover:bg-orange-600">
                    <Shield className="h-3 w-3 mr-1" />
                    Datacenter IP
                </Badge>
            )}

            {/* Device Change */}
            {deviceChange && (
                <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    New Device
                </Badge>
            )}

            {/* Session Frequency */}
            {sessionFrequency?.risk_level && sessionFrequency.risk_level !== 'low' && (
                <Badge
                    variant={sessionFrequency.risk_level === 'high' ? 'destructive' : 'default'}
                    className={sessionFrequency.risk_level === 'medium' ? 'bg-yellow-500 hover:bg-yellow-600' : ''}
                >
                    <Clock className="h-3 w-3 mr-1" />
                    {sessionFrequency.logins_last_hour} logins/hour
                </Badge>
            )}
        </div>
    );
};
