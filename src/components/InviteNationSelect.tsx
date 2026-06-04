import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  bornOrLiveInNationPlaceholder,
  EASY_INVITE_NATIONS,
  type EasyInviteNation,
} from '@/constants/easyInviteNations';
import { cn } from '@/lib/utils';

type InviteNationSelectProps = {
  id: string;
  label?: string;
  value: string;
  onValueChange: (iso3: string) => void;
  triggerClassName?: string;
};

function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function nationSearchValue(nation: EasyInviteNation): string {
  return [nation.name, nation.iso3, nation.iso2].filter(Boolean).join(' ');
}

function nationMatchesSearch(nation: EasyInviteNation, search: string): boolean {
  const query = normalizeForSearch(search.trim());
  if (!query) return true;
  const haystack = normalizeForSearch(nationSearchValue(nation));
  const tokens = query.split(/\s+/).filter(Boolean);
  return tokens.every((token) => haystack.includes(token));
}

export function InviteNationSelect({
  id,
  label = 'Nation',
  value,
  onValueChange,
  triggerClassName = 'border-yellow-300/20 bg-black/70 text-yellow-50',
}: InviteNationSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [placeholder] = useState(bornOrLiveInNationPlaceholder);

  const selected = useMemo(
    () => EASY_INVITE_NATIONS.find((n) => n.iso3 === value) ?? null,
    [value]
  );

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-yellow-100/80">
        {label}
      </Label>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setSearch('');
        }}
        modal={false}
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id}-listbox`}
            onKeyDown={(event) => {
              if (open) return;
              if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
                event.preventDefault();
                setSearch(event.key);
                setOpen(true);
              }
            }}
            className={cn(
              'h-10 w-full justify-between font-normal hover:bg-black/70',
              triggerClassName,
              !selected && 'text-yellow-100/45'
            )}
          >
            <span className="truncate text-left">
              {selected ? (
                <>
                  {selected.flag ? `${selected.flag} ` : ''}
                  {selected.name}
                </>
              ) : (
                placeholder
              )}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          id={`${id}-listbox`}
          align="start"
          className="w-[min(100vw-2rem,var(--radix-popover-trigger-width))] border-yellow-300/20 bg-black p-0 text-yellow-50 sm:w-[var(--radix-popover-trigger-width)]"
        >
          <Command
            value={search}
            onValueChange={setSearch}
            filter={(itemValue, query) => (nationMatchesSearchByValue(itemValue, query) ? 1 : 0)}
            className="bg-black text-yellow-50"
          >
            <CommandInput
              placeholder="Type a country name or code…"
              className="h-11 border-yellow-300/15 text-yellow-50 placeholder:text-yellow-100/40"
            />
            <CommandList className="max-h-72">
              <CommandEmpty className="py-6 text-sm text-yellow-100/55">
                No country matches that search.
              </CommandEmpty>
              <CommandGroup>
                {EASY_INVITE_NATIONS.map((nation) => (
                  <CommandItem
                    key={nation.iso3}
                    value={nation.iso3}
                    onSelect={() => {
                      onValueChange(nation.iso3);
                      setOpen(false);
                    }}
                    className="cursor-pointer text-yellow-100/90 aria-selected:bg-yellow-300/15 aria-selected:text-yellow-50"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0 text-yellow-300',
                        value === nation.iso3 ? 'opacity-100' : 'opacity-0'
                      )}
                      aria-hidden
                    />
                    <span>
                      {nation.flag ? `${nation.flag} ` : ''}
                      {nation.name}
                    </span>
                    <span className="ml-auto pl-2 font-mono text-[10px] uppercase tracking-wider text-yellow-100/35">
                      {nation.iso3}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

const nationByIso3 = new Map(EASY_INVITE_NATIONS.map((n) => [n.iso3, n]));

function nationMatchesSearchByValue(iso3: string, search: string): boolean {
  const nation = nationByIso3.get(iso3);
  if (!nation) return false;
  return nationMatchesSearch(nation, search);
}
