import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your workspace configuration</p>
      </div>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg font-display">General</CardTitle>
          <CardDescription>Workspace and profile settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Workspace Name</Label>
            <Input defaultValue="My Workspace" className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input defaultValue="john@company.com" className="rounded-lg" />
          </div>
          <Button className="rounded-xl">Save Changes</Button>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg font-display">API Keys</CardTitle>
          <CardDescription>Manage integrations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>OpenAI API Key</Label>
            <Input type="password" defaultValue="sk-..." className="rounded-lg font-mono" />
          </div>
          <div className="space-y-2">
            <Label>SMTP Server</Label>
            <Input defaultValue="smtp.sendgrid.net" className="rounded-lg" />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg font-display">Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Email notifications</p>
              <p className="text-xs text-muted-foreground">Get notified on workflow completion</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Error alerts</p>
              <p className="text-xs text-muted-foreground">Immediate alerts on failures</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Weekly digest</p>
              <p className="text-xs text-muted-foreground">Summary of automation performance</p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
