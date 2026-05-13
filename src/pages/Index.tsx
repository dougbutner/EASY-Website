/**
 * Index page — main template page composing Header + TransactionForm.
 */
import { Header } from '@/components/Header';
import { TransactionForm } from '@/components/TransactionForm';
import { useProton } from '@/hooks/useProton';

const Index = () => {
  const {
    actor,
    isLoggedIn,
    loading,
    wallets,
    activeId,
    addWebAuthWallet,
    addAnchorWallet,
    setActive,
    removeWallet,
    disconnectAll,
    transact,
  } = useProton();

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        actor={actor}
        isLoggedIn={isLoggedIn}
        loading={loading}
        wallets={wallets}
        activeId={activeId}
        onAddWebAuth={addWebAuthWallet}
        onAddAnchor={addAnchorWallet}
        onSetActive={setActive}
        onRemoveWallet={removeWallet}
        onDisconnectAll={disconnectAll}
      />

      <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-foreground">
            XPR Network multi login template
          </h2>
          <p className="mt-2 max-w-md text-muted-foreground">
            Use this template for everyday XPR work: ship a portfolio or activity view, move tokens, wire a game
            or backend to a signed account, read chain data, try DeFi flows, or demo “connect and transact” in a
            talk—without rebuilding wallet plumbing. It pairs naturally with EASY and other{' '}
            <a
              href="https://flex.report"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline-offset-2 hover:text-accent hover:underline"
            >
              Flextokens
            </a>
            {' '}
            when your product touches those communities. The{' '}
            <span className="font-medium text-foreground/90">skill/</span> folder in the repository bundles
            markdown guides for you or an AI to follow. The most important threads run through{' '}
            <span className="text-foreground/90">
              contracts, wallets, tokens, Flextokens, NFTs, DeFi, RPC, staking, accounts, testing
            </span>
            . Connect with WebAuth or Anchor, use multiple accounts in the header, switch the active signer, and
            push transactions.
          </p>
        </div>

        <TransactionForm onTransact={transact} isLoggedIn={isLoggedIn} />
      </main>

      <footer className="border-t px-6 py-4 text-center text-sm text-muted-foreground">
        <p>
          This template is provided by{' '}
          <a
            href="https://alcor.exchange/v/xpr/swap?input=xusdc-xtokens&output=easy-mon3y"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline-offset-2 hover:text-accent hover:underline"
          >
            EASY
          </a>{' '}
          the #1 community altcoin on XPR by{' '}
          <a
            href="https://alcor.exchange/v/xpr/analytics/tokens/easy-mon3y"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline-offset-2 hover:text-accent hover:underline"
          >
            volume
          </a>
          .
        </p>
        <p className="mt-2">Built on XPR Network — Powered by Proton Web SDK</p>
      </footer>
    </div>
  );
};

export default Index;
