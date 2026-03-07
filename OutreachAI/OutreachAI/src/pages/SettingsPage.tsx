import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { getFromEmail, setFromEmail, getMeetingLink, setMeetingLink } from "@/lib/edge-functions";

export default function SettingsPage() {
  const [fromEmail, setFromEmailValue] = useState(getFromEmail());
  const [meetingLink, setMeetingLinkValue] = useState(getMeetingLink());

  useEffect(() => {
    setFromEmailValue(getFromEmail());
    setMeetingLinkValue(getMeetingLink());
  }, []);

  const handleSaveFromEmail = () => {
    setFromEmail(fromEmail);
    toast.success("Sender email saved. Emails will now go to your leads when you use a verified domain.");
  };

  const handleSaveMeetingLink = () => {
    setMeetingLink(meetingLink);
    toast.success("Meeting link saved. It will be added to follow-ups when a lead replies positively.");
  };

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
          <CardTitle className="text-lg font-display">Email</CardTitle>
          <CardDescription>Send to leads — no domain required if you use Gmail</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Option A: Gmail (no domain needed)</Label>
            <p className="text-xs text-muted-foreground">
              Add to <code className="bg-muted px-1 rounded">.env</code>: <code className="bg-muted px-1 rounded">GMAIL_USER=your@gmail.com</code> and <code className="bg-muted px-1 rounded">GMAIL_APP_PASSWORD=your-16-char-app-password</code>. Enable 2-Step Verification, then create an App Password at{" "}
              <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-primary underline">myaccount.google.com/apppasswords</a>. Restart <code className="bg-muted px-1 rounded">npm run dev</code> after saving.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Option B: Resend (needs verified domain for leads)</Label>
            <p className="text-xs text-muted-foreground">
              Set <code className="bg-muted px-1 rounded">RESEND_API_KEY</code> in <code className="bg-muted px-1 rounded">.env</code>. To send to leads, verify a domain at{" "}
              <a href="https://resend.com/domains" target="_blank" rel="noreferrer" className="text-primary underline">resend.com/domains</a> and set the sender below.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Sender (From) email — for Resend or display name with Gmail</Label>
            <Input
              value={fromEmail}
              onChange={(e) => setFromEmailValue(e.target.value)}
              placeholder="OutreachAI &lt;your@gmail.com&gt; or &lt;outreach@yourdomain.com&gt;"
              className="rounded-lg font-mono"
            />
            <Button className="rounded-xl" onClick={handleSaveFromEmail}>Save sender email</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-lg font-display">Meeting link (Calendly)</CardTitle>
          <CardDescription>When a lead replies positively, follow-up emails can include this link so they can book a time. The meeting will appear on your connected calendar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Calendly or booking page URL</Label>
            <Input
              value={meetingLink}
              onChange={(e) => setMeetingLinkValue(e.target.value)}
              placeholder="https://calendly.com/yourname/15min"
              className="rounded-lg font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Create a free account at <a href="https://calendly.com" target="_blank" rel="noreferrer" className="text-primary underline">calendly.com</a>, connect your Google Calendar, then paste your booking link here.
            </p>
            <Button className="rounded-xl" onClick={handleSaveMeetingLink}>Save meeting link</Button>
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
