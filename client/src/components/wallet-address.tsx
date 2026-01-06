import { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface WalletAddressProps {
  address: string;
  truncate?: boolean;
  showCopy?: boolean;
  showExternalLink?: boolean;
  className?: string;
}

export function WalletAddress({
  address,
  truncate = true,
  showCopy = true,
  showExternalLink = false,
  className,
}: WalletAddressProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const displayAddress = truncate
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    toast({
      title: "Address copied",
      description: "Wallet address copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const polygonscanUrl = `https://polygonscan.com/address/${address}`;

  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <code
        className="font-mono text-sm"
        title={address}
        data-testid={`text-wallet-${address.slice(0, 6)}`}
      >
        {displayAddress}
      </code>
      {showCopy && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleCopy}
          data-testid={`button-copy-${address.slice(0, 6)}`}
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      )}
      {showExternalLink && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          asChild
        >
          <a
            href={polygonscanUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`link-polygonscan-${address.slice(0, 6)}`}
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </Button>
      )}
    </div>
  );
}
