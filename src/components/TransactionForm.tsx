/**
 * TransactionForm — form to push actions to XPR Network smart contracts.
 * Abstracts blockchain interaction into simple form fields.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, CheckCircle, AlertCircle } from 'lucide-react';

interface TransactionFormProps {
  onTransact: (actions: Array<{ account: string; name: string; data: Record<string, any> }>) => Promise<any>;
  isLoggedIn: boolean;
}

export function TransactionForm({ onTransact, isLoggedIn }: TransactionFormProps) {
  const [contract, setContract] = useState('');
  const [action, setAction] = useState('');
  const [data, setData] = useState('{}');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    // Validate JSON data
    let parsedData: Record<string, any>;
    try {
      parsedData = JSON.parse(data);
    } catch {
      setResult({ success: false, message: 'Invalid JSON in action data.' });
      return;
    }

    if (!contract.trim() || !action.trim()) {
      setResult({ success: false, message: 'Contract and action name are required.' });
      return;
    }

    setSubmitting(true);
    try {
      const txResult = await onTransact([
        { account: contract.trim(), name: action.trim(), data: parsedData },
      ]);
      setResult({
        success: true,
        message: `Transaction successful! ID: ${txResult?.processed?.id?.slice(0, 12) ?? 'OK'}…`,
      });
    } catch (err: any) {
      setResult({
        success: false,
        message: err?.message || 'Transaction failed.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5 text-primary" />
          Push Transaction
        </CardTitle>
        <CardDescription>
          Send an action to any XPR Network smart contract.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contract">Contract Account</Label>
            <Input
              id="contract"
              placeholder="e.g. eosio.token"
              value={contract}
              onChange={(e) => setContract(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="action">Action Name</Label>
            <Input
              id="action"
              placeholder="e.g. transfer"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="data">Action Data (JSON)</Label>
            <Textarea
              id="data"
              placeholder='{"from":"myaccount","to":"other","quantity":"1.0000 XPR","memo":"hello"}'
              value={data}
              onChange={(e) => setData(e.target.value)}
              rows={5}
              className="font-mono text-sm"
            />
          </div>

          {result && (
            <div
              className={`flex items-start gap-2 rounded-md p-3 text-sm ${
                result.success
                  ? 'bg-success/10 text-success'
                  : 'bg-destructive/10 text-destructive'
              }`}
            >
              {result.success ? (
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{result.message}</span>
            </div>
          )}

          <Button type="submit" disabled={!isLoggedIn || submitting} className="w-full">
            {submitting ? 'Sending…' : !isLoggedIn ? 'Connect Wallet First' : 'Send Transaction'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
