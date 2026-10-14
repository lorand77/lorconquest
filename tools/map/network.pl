#!/usr/bin/perl
# Draw the settlement network (connections + mountain passes) on top of the clean map.
#
#   perl tools/map/network.pl docs/plan/map-clean.png docs/plan/map-connections.png
#
# Reads tools/map/connections.txt and docs/plan/countries-with-letter-names-and-numbers-for-settlements-in-them.txt.
# Prints the pass table (position, routes, owning settlement and country).
use strict; use warnings;
use FindBin; require "$FindBin::Bin/pngio.pl";

my ($in, $out) = @ARGV; die "usage: $0 map-clean.png out.png\n" unless $in && $out;
my $ROOT = "$FindBin::Bin/../..";

# Mountain passes: each pass serves the listed routes; the routes run settlement -> pass -> settlement.
my @PASSES = (
    ['41-42', '41-45', '41-46'],            # Swiss west
    ['41-47', '40-47'],                     # Swiss north
    ['39-40'],                              # Swiss east
    ['30-36', '30-72'],                     # Bohemia west
    ['30-73', '30-85', '29-85'],            # Bohemia north
    ['28-35', '28-33', '28-31', '28-32'],   # Bohemia south
    ['29-86'],                              # Bohemia east
);

# Approximate settlement positions (read off the numbered map); real markers are matched to these.
my %APPROX = (1=>[233,147],2=>[445,50],3=>[770,33],4=>[330,186],5=>[448,177],6=>[581,190],7=>[519,280],8=>[368,248],9=>[313,297],
 10=>[420,305],11=>[435,375],12=>[402,445],13=>[558,419],14=>[655,409],15=>[925,398],16=>[1052,402],17=>[1120,390],18=>[1135,301],19=>[1151,161],
 20=>[1145,466],21=>[1228,597],22=>[1171,672],23=>[1155,770],24=>[1276,819],26=>[1074,1030],28=>[828,943],29=>[884,886],30=>[775,867],31=>[862,1088],
 32=>[809,1065],33=>[755,1037],34=>[635,1031],35=>[667,982],36=>[626,918],37=>[555,918],38=>[499,978],39=>[525,1085],40=>[349,1085],41=>[289,1097],
 42=>[169,1113],43=>[119,1088],44=>[125,1022],45=>[178,982],46=>[258,965],47=>[363,973],48=>[446,914],49=>[338,886],50=>[327,803],51=>[292,752],
 52=>[200,859],53=>[102,883],54=>[36,802],55=>[122,729],56=>[38,676],57=>[48,565],58=>[119,618],59=>[222,678],60=>[191,787],61=>[252,718],
 62=>[252,644],63=>[272,614],64=>[188,530],65=>[213,444],66=>[305,433],67=>[329,516],68=>[415,590],69=>[502,539],70=>[450,677],71=>[570,775],
 72=>[673,801],73=>[750,709],74=>[603,636],75=>[557,471],76=>[622,494],77=>[701,580],78=>[735,465],79=>[858,434],80=>[881,487],81=>[1000,499],
 82=>[845,541],83=>[789,637],84=>[922,624],85=>[813,750],86=>[955,795],87=>[1055,704],88=>[1065,607],89=>[1142,42]);

my ($W, $H, $I) = load_png($in);
my @ORIG = map { [ map { [@$_] } @$_ ] } @$I;
sub inb { $_[0] >= 0 && $_[1] >= 0 && $_[0] < $W && $_[1] < $H }
sub px { $ORIG[$_[1]][$_[0]] }
sub is_sea   { my $p = px(@_); $p->[0] == 153 && $p->[1] == 217 && $p->[2] == 234 }
sub is_black { my $p = px(@_); $p->[0] < 70 && $p->[1] < 70 && $p->[2] < 70 }
sub is_bgray { my $p = px(@_); $p->[0] == $p->[1] && $p->[1] == $p->[2] && $p->[0] >= 100 && $p->[0] <= 215 }
sub is_river { my $p = px(@_); $p->[2] > 150 && $p->[0] < 120 && !is_sea(@_) }
my @N4 = ([1, 0], [-1, 0], [0, 1], [0, -1]);

# ---------- markers: town circles and city squares, matched to settlement numbers ----------
my (%C, %mk, %isCity);
{
    # towns and cities share one red; cities are solid 22x22 squares, towns are circles
    my (@found, %seen);
    my $red = sub { my $p = px(@_); $p->[0] == 201 && $p->[1] == 22 && $p->[2] == 31 };
    for my $y (0 .. $H - 1) { for my $x (0 .. $W - 1) { next if $seen{"$x,$y"} || !$red->($x, $y);
        my @q = ([$x, $y]); $seen{"$x,$y"} = 1; my @c;
        while (my $e = pop @q) { push @c, $e; my ($a, $b) = @$e; for (@N4) { my ($u, $v) = ($a + $_->[0], $b + $_->[1]); next if !inb($u, $v) || $seen{"$u,$v"};
            next unless $red->($u, $v); $seen{"$u,$v"} = 1; push @q, [$u, $v] } }
        next if @c < 100;
        my ($x0, $y0, $x1, $y1) = (1e9, 1e9, -1, -1);
        for (@c) { $x0 = $_->[0] if $_->[0] < $x0; $x1 = $_->[0] if $_->[0] > $x1; $y0 = $_->[1] if $_->[1] < $y0; $y1 = $_->[1] if $_->[1] > $y1 }
        my $square = $x1 - $x0 == 21 && $y1 - $y0 == 21 && @c == 484;
        push @found, $square ? [$x0 + 10.5, $y0 + 10.5, 1] : do { my ($sx, $sy) = (0, 0); $sx += $_->[0], $sy += $_->[1] for @c; [$sx / @c, $sy / @c, 0] } } }
    my %used;
    for my $m (@found) { my ($best, $bd) = (undef, 1e9);
        for my $id (keys %APPROX) { my $d = sqrt(($APPROX{$id}[0] - $m->[0])**2 + ($APPROX{$id}[1] - $m->[1])**2); ($best, $bd) = ($id, $d) if $d < $bd }
        die sprintf("marker at %d,%d matches no settlement\n", @$m) if $bd > 14; die "settlement $best matched twice\n" if $used{$best}++;
        $C{$best} = [ $m->[0], $m->[1] ]; $isCity{$best} = $m->[2] }
    die "expected 87 settlements, found " . scalar(keys %C) . "\n" unless keys %C == 87;
    for my $id (keys %C) { my ($cx, $cy) = @{ $C{$id} };
        if ($isCity{$id}) { my ($x0, $y0) = (int($cx - 10), int($cy - 10)); for my $y ($y0 .. $y0 + 21) { for my $x ($x0 .. $x0 + 21) { $mk{"$x,$y"} = $id } } }
        else { for my $y (int($cy) - 11 .. int($cy) + 11) { for my $x (int($cx) - 11 .. int($cx) + 11) { $mk{"$x,$y"} = $id if ($x + 0.5 - $cx)**2 + ($y + 0.5 - $cy)**2 <= 10.5**2 } } } }
}

# ---------- connections ----------
my (%land, %strait, %NAME, %country, %cname);
{ open my $f, '<', "$FindBin::Bin/connections.txt" or die "connections.txt: $!";
  while (<$f>) { next if /^#/; next unless /^(\d+) ([^:]*):\s*([\d, ]*?)\s*(?:\|\s*strait:\s*([\d, ]+))?\s*$/; my $a = $1; $NAME{$a} = $2;
      for my $b (grep { /\d/ } split /,\s*/, $3) { my $k = $a < $b ? "$a-$b" : "$b-$a"; $land{$k}{$a} = 1 }
      for my $b (grep { /\d/ } split /,\s*/, ($4 // '')) { my $k = $a < $b ? "$a-$b" : "$b-$a"; $strait{$k}{$a} = 1 } } }
for my $k (keys %land, keys %strait) { my ($a, $b) = split /-/, $k; my $h = $land{$k} // $strait{$k};
    warn "connection $k is listed under only one of its settlements\n" unless $h->{$a} && $h->{$b} }
{ open my $f, '<', "$ROOT/docs/plan/countries-with-letter-names-and-numbers-for-settlements-in-them.txt" or die $!;
  while (<$f>) { next unless /^(\w+) (.+?) ([\d,]+)\s*$/; my ($code, $name) = (uc $1, $2); $cname{$code} = $name; $country{$_} = $code for split /,/, $3 } }

# ---------- passes: centre of where their routes cross the mountains ----------
my %zone;
for my $y (0 .. $H - 1) { for my $x (0 .. $W - 1) { my $p = px($x, $y); next unless $p->[0] == 136 && $p->[1] == 0 && $p->[2] == 21;
    for my $dy (-20 .. 20) { for my $dx (-20 .. 20) { $zone{ ($x + $dx) . "," . ($y + $dy) } = 1 if $dx * $dx + $dy * $dy <= 400 } } } }
sub mountain_mid { my ($a, $b) = @_; my ($x1, $y1) = @{ $C{$a} }; my ($x2, $y2) = @{ $C{$b} }; my $L = sqrt(($x2 - $x1)**2 + ($y2 - $y1)**2);
    my ($best, $bs, $run, $rs) = (0, 0, 0, 0);
    for my $i (0 .. int($L)) { my $in = $i >= 14 && $i <= $L - 14 && $zone{ int($x1 + ($x2 - $x1) * $i / $L) . "," . int($y1 + ($y2 - $y1) * $i / $L) };
        if ($in) { $rs = $i unless $run; $run++; ($best, $bs) = ($run, $rs) if $run > $best } else { $run = 0 } }
    my $m = $best ? $bs + $best / 2 : $L / 2; return ($x1 + ($x2 - $x1) * $m / $L, $y1 + ($y2 - $y1) * $m / $L) }
my (@pass, %via);
for my $g (@PASSES) { my ($sx, $sy) = (0, 0);
    for my $r (@$g) { die "pass route $r is not a connection\n" unless $land{$r}; my ($x, $y) = mountain_mid(split /-/, $r); $sx += $x; $sy += $y }
    push @pass, { x => $sx / @$g, y => $sy / @$g, routes => $g } }
@pass = sort { $a->{x} <=> $b->{x} } @pass;
for my $i (0 .. $#pass) { $via{$_} = $i for @{ $pass[$i]{routes} } }

# owner: the settlement whose land the pass lies in (nearest settlement reachable without crossing a border)
my %wall;
for my $y (0 .. $H - 1) { for my $x (0 .. $W - 1) { $wall{"$x,$y"} = 1 if is_sea($x, $y) || is_black($x, $y) || (is_bgray($x, $y) && !defined $mk{"$x,$y"}) } }
for my $y (0 .. $H - 1) { for my $x (0 .. $W - 1) { next unless is_river($x, $y);
    for my $d ([1, 0], [0, 1], [1, 1], [1, -1]) { my ($f, $b) = (0, 0);
        for my $k (1 .. 4) { $f ||= inb($x + $d->[0] * $k, $y + $d->[1] * $k) && is_bgray($x + $d->[0] * $k, $y + $d->[1] * $k);
                             $b ||= inb($x - $d->[0] * $k, $y - $d->[1] * $k) && is_bgray($x - $d->[0] * $k, $y - $d->[1] * $k) }
        if ($f && $b) { $wall{"$x,$y"} = 1; last } } } }
for my $p (@pass) { my ($sx, $sy) = (int($p->{x} + 0.5), int($p->{y} + 0.5));
    if ($wall{"$sx,$sy"}) { $p->{onborder} = 1; my $bd = 99;
        for my $dy (-6 .. 6) { for my $dx (-6 .. 6) { next if $wall{ ($sx + $dx) . "," . ($sy + $dy) }; my $d = $dx * $dx + $dy * $dy; ($bd, $p->{nx}, $p->{ny}) = ($d, $sx + $dx, $sy + $dy) if $d < $bd } }
        ($sx, $sy) = ($p->{nx}, $p->{ny}) }
    my %seen = ("$sx,$sy" => 1); my @q = ([$sx, $sy]); my $own;
    B: while (@q) { my @next; for my $c (@q) { my ($x, $y) = @$c;
        for (@N4) { my ($u, $v) = ($x + $_->[0], $y + $_->[1]); my $k = "$u,$v"; next if !inb($u, $v) || $seen{$k}++;
            if (defined $mk{$k}) { $own = $mk{$k}; last B } next if $wall{$k}; push @next, [$u, $v] } } @q = @next }
    $p->{owner} = $own; $p->{country} = $country{$own} }

# ---------- draw ----------
sub seg { my ($x1, $y1, $x2, $y2, $hw, $cov) = @_; my ($dx, $dy) = ($x2 - $x1, $y2 - $y1); my $L2 = $dx * $dx + $dy * $dy;
    for my $y (int(($y1 < $y2 ? $y1 : $y2) - $hw) - 1 .. int(($y1 > $y2 ? $y1 : $y2) + $hw) + 1) {
        for my $x (int(($x1 < $x2 ? $x1 : $x2) - $hw) - 1 .. int(($x1 > $x2 ? $x1 : $x2) + $hw) + 1) { next unless inb($x, $y); my $c = 0;
            for my $sy (0 .. 3) { for my $sx (0 .. 3) { my ($px, $py) = ($x + ($sx + 0.5) / 4, $y + ($sy + 0.5) / 4);
                my $t = $L2 ? (($px - $x1) * $dx + ($py - $y1) * $dy) / $L2 : 0; $t = 0 if $t < 0; $t = 1 if $t > 1;
                $c++ if ($px - $x1 - $t * $dx)**2 + ($py - $y1 - $t * $dy)**2 <= $hw * $hw } }
            $cov->{"$x,$y"} = $c if $c && $c > ($cov->{"$x,$y"} // 0) } } }
my %cov;
for my $e (sort keys %land) { my ($a, $b) = split /-/, $e; my ($x1, $y1) = map { $_ + 0.5 } @{ $C{$a} }; my ($x2, $y2) = map { $_ + 0.5 } @{ $C{$b} };
    if (defined $via{$e}) { my ($px, $py) = ($pass[ $via{$e} ]{x} + 0.5, $pass[ $via{$e} ]{y} + 0.5); seg($x1, $y1, $px, $py, 1.1, \%cov); seg($px, $py, $x2, $y2, 1.1, \%cov) }
    else { seg($x1, $y1, $x2, $y2, 1.1, \%cov) } }
for my $e (sort keys %strait) { my ($a, $b) = split /-/, $e; my ($x1, $y1) = map { $_ + 0.5 } @{ $C{$a} }; my ($x2, $y2) = map { $_ + 0.5 } @{ $C{$b} };
    my $L = sqrt(($x2 - $x1)**2 + ($y2 - $y1)**2); my $n = int($L / 7);
    for my $i (0 .. $n - 1) { next if $i % 2; seg($x1 + ($x2 - $x1) * $i / $n, $y1 + ($y2 - $y1) * $i / $n, $x1 + ($x2 - $x1) * ($i + 1) / $n, $y1 + ($y2 - $y1) * ($i + 1) / $n, 1.1, \%cov) } }
for my $k (keys %cov) { next if $mk{$k}; my ($x, $y) = split /,/, $k; my $a = $cov{$k} / 16; my $p = $I->[$y][$x];
    $I->[$y][$x] = [ (map { int((163, 73, 164)[$_] * $a + $p->[$_] * (1 - $a) + 0.5) } 0 .. 2), 255 ] }
# passes: yellow triangles with a dark outline
my $TS = 20;
for my $p (@pass) { my ($cx, $cy) = ($p->{x} + 0.5, $p->{y} + 0.5); my $h = $TS * sqrt(3) / 2;
    my @v = ([$cx, $cy - 2 * $h / 3], [$cx - $TS / 2, $cy + $h / 3], [$cx + $TS / 2, $cy + $h / 3]);
    my $inside = sub { my ($x, $y, $grow) = @_;
        for my $i (0 .. 2) { my ($ax, $ay) = @{ $v[$i] }; my ($bx, $by) = @{ $v[($i + 1) % 3] };
            my ($nx, $ny) = ($by - $ay, -($bx - $ax)); my $nl = sqrt($nx * $nx + $ny * $ny); $nx /= $nl; $ny /= $nl;
            ($nx, $ny) = (-$nx, -$ny) if ($cx - $ax) * $nx + ($cy - $ay) * $ny > 0;      # outward
            return 0 if ($x - $ax) * $nx + ($y - $ay) * $ny > $grow }
        return 1 };
    for my $y (int($cy - $h) - 2 .. int($cy + $h / 2) + 2) { for my $x (int($cx - $TS / 2) - 2 .. int($cx + $TS / 2) + 2) { next unless inb($x, $y);
        my ($cin, $cout) = (0, 0);
        for my $sy (0 .. 3) { for my $sx (0 .. 3) { my ($px, $py) = ($x + ($sx + 0.5) / 4, $y + ($sy + 0.5) / 4);
            $cout++ if $inside->($px, $py, 0.6); $cin++ if $inside->($px, $py, -0.9) } }
        next unless $cout; my ($af, $al) = ($cin / 16, ($cout - $cin) / 16); my $q = $I->[$y][$x];
        $I->[$y][$x] = [ (map { int((255, 230, 0)[$_] * $af + 40 * $al + $q->[$_] * (1 - $af - $al) + 0.5) } 0 .. 2), 255 ] } } }
for my $k (keys %mk) { my ($x, $y) = split /,/, $k; next unless inb($x, $y); $I->[$y][$x] = [ @{ $ORIG[$y][$x] } ] }
save_png($out, $W, $H, $I);

# ---------- report ----------
printf "%d settlements, %d land + %d strait connections, %d passes\n", scalar keys %C, scalar keys %land, scalar keys %strait, scalar @pass;
for my $i (0 .. $#pass) { my $p = $pass[$i];
    my $near = 1e9; for my $id (keys %C) { my $d = sqrt(($C{$id}[0] - $p->{x})**2 + ($C{$id}[1] - $p->{y})**2); $near = $d if $d < $near }
    printf "P%d (%d,%d)  routes %-28s  land of %d %s  ->  %s %s%s%s\n", $i + 1, $p->{x}, $p->{y}, join(" ", @{ $p->{routes} }),
        $p->{owner}, $NAME{ $p->{owner} }, $p->{country}, $cname{ $p->{country} },
        $p->{onborder} ? "  [ON A BORDER LINE]" : '', $near < 22 ? sprintf("  [only %.0fpx from a settlement]", $near) : '' }
print "wrote $out\n";
