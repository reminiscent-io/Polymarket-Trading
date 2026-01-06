import { Settings as SettingsIcon, Bell, Shield, RefreshCw, Database } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "@/components/theme-provider";

export default function Settings() {
  const { theme } = useTheme();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure detection parameters and notification preferences
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-muted-foreground" />
              Detection Parameters
            </CardTitle>
            <CardDescription>
              Adjust the risk scoring algorithm thresholds
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>High Risk Threshold</Label>
                <p className="text-xs text-muted-foreground">
                  Score above which wallets are flagged as high risk
                </p>
              </div>
              <span className="font-mono text-sm font-medium" data-testid="text-high-risk-threshold">
                60
              </span>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Critical Risk Threshold</Label>
                <p className="text-xs text-muted-foreground">
                  Score above which wallets require immediate review
                </p>
              </div>
              <span className="font-mono text-sm font-medium" data-testid="text-critical-threshold">
                80
              </span>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Timing Proximity Window</Label>
                <p className="text-xs text-muted-foreground">
                  Hours before resolution to flag bets
                </p>
              </div>
              <span className="font-mono text-sm font-medium" data-testid="text-timing-window">
                72h
              </span>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Win Rate Threshold</Label>
                <p className="text-xs text-muted-foreground">
                  Win rate on early bets considered suspicious
                </p>
              </div>
              <span className="font-mono text-sm font-medium" data-testid="text-winrate-threshold">
                70%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="h-5 w-5 text-muted-foreground" />
              Notifications
            </CardTitle>
            <CardDescription>
              Configure when and how you receive alerts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="critical-alerts">Critical Risk Alerts</Label>
                <p className="text-xs text-muted-foreground">
                  Get notified when critical risk wallets are detected
                </p>
              </div>
              <Switch id="critical-alerts" defaultChecked data-testid="switch-critical-alerts" />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="daily-summary">Daily Summary</Label>
                <p className="text-xs text-muted-foreground">
                  Receive a daily digest of flagged activity
                </p>
              </div>
              <Switch id="daily-summary" defaultChecked data-testid="switch-daily-summary" />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="market-alerts">Market Activity Alerts</Label>
                <p className="text-xs text-muted-foreground">
                  Get notified when markets have unusual activity
                </p>
              </div>
              <Switch id="market-alerts" data-testid="switch-market-alerts" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <SettingsIcon className="h-5 w-5 text-muted-foreground" />
              Appearance
            </CardTitle>
            <CardDescription>
              Customize how the dashboard looks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Theme</Label>
                <p className="text-xs text-muted-foreground">
                  Switch between light and dark mode
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground capitalize">{theme}</span>
                <ThemeToggle />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="h-5 w-5 text-muted-foreground" />
              Data Management
            </CardTitle>
            <CardDescription>
              Manage blockchain data synchronization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Sync Interval</Label>
                <p className="text-xs text-muted-foreground">
                  How often to poll for new transactions
                </p>
              </div>
              <span className="font-mono text-sm font-medium" data-testid="text-sync-interval">
                15 min
              </span>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Data Retention</Label>
                <p className="text-xs text-muted-foreground">
                  Keep historical data for analysis
                </p>
              </div>
              <span className="font-mono text-sm font-medium" data-testid="text-data-retention">
                30 days
              </span>
            </div>

            <Separator />

            <div className="flex flex-col gap-3">
              <Button variant="outline" className="w-full" data-testid="button-force-sync">
                <RefreshCw className="mr-2 h-4 w-4" />
                Force Sync Now
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
