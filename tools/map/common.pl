# Shared map data and helpers for the tools/map scripts.
use strict; use warnings; use File::Basename qw(dirname); use Cwd qw(abs_path);
our $DIR  = dirname(abs_path(__FILE__));
our $ROOT = "$DIR/../..";
require "$DIR/pngio.pl";
our @RED   = (201, 22, 31);     # towns and cities
our @RIVER = (0, 162, 232);
our @SEA   = (153, 217, 234);
our @BORDER = (127, 127, 127);

# Approximate settlement positions (read off the numbered map); real markers are matched to these.
our %APPROX = (1=>[233,147],2=>[445,50],3=>[770,33],4=>[330,186],5=>[448,177],6=>[581,190],7=>[519,280],8=>[368,248],9=>[313,297],
 10=>[420,305],11=>[435,375],12=>[402,445],13=>[558,419],14=>[655,409],15=>[925,398],16=>[1052,402],17=>[1120,390],18=>[1135,301],19=>[1151,161],
 20=>[1145,466],21=>[1228,597],22=>[1171,672],23=>[1155,770],24=>[1276,819],26=>[1074,1030],28=>[828,943],29=>[884,886],30=>[775,867],31=>[862,1088],
 32=>[809,1065],33=>[755,1037],34=>[635,1031],35=>[667,982],36=>[626,918],37=>[555,918],38=>[499,978],39=>[525,1085],40=>[349,1085],41=>[289,1097],
 42=>[169,1113],43=>[119,1088],44=>[125,1022],45=>[178,982],46=>[258,965],47=>[363,973],48=>[446,914],49=>[338,886],50=>[327,803],51=>[292,752],
 52=>[200,859],53=>[102,883],54=>[36,802],55=>[122,729],56=>[38,676],57=>[48,565],58=>[119,618],59=>[222,678],60=>[191,787],61=>[252,718],
 62=>[252,644],63=>[272,614],64=>[188,530],65=>[213,444],66=>[305,433],67=>[329,516],68=>[415,590],69=>[502,539],70=>[450,677],71=>[570,775],
 72=>[673,801],73=>[750,709],74=>[603,636],75=>[557,471],76=>[622,494],77=>[701,580],78=>[735,465],79=>[858,434],80=>[881,487],81=>[1000,499],
 82=>[845,541],83=>[789,637],84=>[922,624],85=>[813,750],86=>[955,795],87=>[1055,704],88=>[1065,607],89=>[1142,42]);

# find_settlements($I, $W, $H) -> (\%centre, \%isCity, \%markerPixel)
# Towns are red circles (radius 9), cities red 22x22 squares; both use @RED.
sub find_settlements {
    my ($I, $W, $H) = @_;
    my $red = sub { my $p = $I->[$_[1]][$_[0]]; $p->[0] == $RED[0] && $p->[1] == $RED[1] && $p->[2] == $RED[2] };
    my (@found, %seen);
    for my $y (0 .. $H - 1) { for my $x (0 .. $W - 1) { next if $seen{"$x,$y"} || !$red->($x, $y);
        my @q = ([$x, $y]); $seen{"$x,$y"} = 1; my @c;
        while (my $e = pop @q) { push @c, $e; my ($a, $b) = @$e;
            for ([1, 0], [-1, 0], [0, 1], [0, -1]) { my ($u, $v) = ($a + $_->[0], $b + $_->[1]);
                next if $u < 0 || $v < 0 || $u >= $W || $v >= $H || $seen{"$u,$v"} || !$red->($u, $v); $seen{"$u,$v"} = 1; push @q, [$u, $v] } }
        next if @c < 100;
        my ($x0, $y0, $x1, $y1) = (1e9, 1e9, -1, -1);
        for (@c) { $x0 = $_->[0] if $_->[0] < $x0; $x1 = $_->[0] if $_->[0] > $x1; $y0 = $_->[1] if $_->[1] < $y0; $y1 = $_->[1] if $_->[1] > $y1 }
        if ($x1 - $x0 == 21 && $y1 - $y0 == 21 && @c == 484) { push @found, [$x0 + 10.5, $y0 + 10.5, 1] }
        else { my ($sx, $sy) = (0, 0); $sx += $_->[0], $sy += $_->[1] for @c; push @found, [$sx / @c, $sy / @c, 0] } } }
    my (%C, %city, %mk, %used);
    for my $m (@found) { my ($best, $bd) = (undef, 1e9);
        for my $id (keys %APPROX) { my $d = sqrt(($APPROX{$id}[0] - $m->[0])**2 + ($APPROX{$id}[1] - $m->[1])**2); ($best, $bd) = ($id, $d) if $d < $bd }
        die sprintf("marker at %d,%d matches no settlement\n", @$m) if $bd > 14; die "settlement $best matched twice\n" if $used{$best}++;
        $C{$best} = [ $m->[0], $m->[1] ]; $city{$best} = $m->[2] }
    die "expected 87 settlements, found " . scalar(keys %C) . "\n" unless keys %C == 87;
    for my $id (keys %C) { for my $k (marker_pixels($C{$id}, $city{$id})) { $mk{$k} = $id } }
    return (\%C, \%city, \%mk);
}
sub marker_pixels { my ($c, $isCity) = @_; my ($cx, $cy) = @$c; my @k;
    if ($isCity) { my ($x0, $y0) = (int($cx - 10), int($cy - 10)); for my $y ($y0 .. $y0 + 21) { for my $x ($x0 .. $x0 + 21) { push @k, "$x,$y" } } }
    else { for my $y (int($cy) - 11 .. int($cy) + 11) { for my $x (int($cx) - 11 .. int($cx) + 11) { push @k, "$x,$y" if ($x + 0.5 - $cx)**2 + ($y + 0.5 - $cy)**2 <= 10.5**2 } } }
    return @k }

# draw_settlements($I, $W, $H, \%C, \%isCity): repaint every marker exactly (circle r=9 anti-aliased, 22px square)
sub draw_settlements {
    my ($I, $W, $H, $C, $city) = @_;
    for my $id (keys %$C) { my ($cx, $cy) = @{ $C->{$id} };
        if ($city->{$id}) { my ($x0, $y0) = (int($cx - 10), int($cy - 10)); for my $y ($y0 .. $y0 + 21) { for my $x ($x0 .. $x0 + 21) { $I->[$y][$x] = [@RED, 255] } } next }
        for my $y (int($cy) - 11 .. int($cy) + 11) { for my $x (int($cx) - 11 .. int($cx) + 11) { next if $x < 0 || $y < 0 || $x >= $W || $y >= $H; my $c = 0;
            for my $sy (0 .. 3) { for my $sx (0 .. 3) { $c++ if ($x + ($sx + 0.5) / 4 - $cx)**2 + ($y + ($sy + 0.5) / 4 - $cy)**2 <= 81 } }
            next unless $c; my $a = $c / 16; my $p = $I->[$y][$x];
            $I->[$y][$x] = [ (map { int($RED[$_] * $a + $p->[$_] * (1 - $a) + 0.5) } 0 .. 2), 255 ] } } }
}

# read_connections() -> (\%land, \%strait, \%name); keys are "a-b" with a < b
sub read_connections {
    my (%land, %strait, %name);
    open my $f, '<', "$DIR/connections.txt" or die "connections.txt: $!";
    while (<$f>) { next if /^#/; next unless /^(\d+) ([^:]*):\s*([\d, ]*?)\s*(?:\|\s*strait:\s*([\d, ]+))?\s*$/; my $a = $1; $name{$a} = $2;
        for my $b (grep { /\d/ } split /,\s*/, $3) { $land{ $a < $b ? "$a-$b" : "$b-$a" }{$a} = 1 }
        for my $b (grep { /\d/ } split /,\s*/, ($4 // '')) { $strait{ $a < $b ? "$a-$b" : "$b-$a" }{$a} = 1 } }
    for my $k (keys %land, keys %strait) { my ($a, $b) = split /-/, $k; my $h = $land{$k} // $strait{$k};
        warn "connection $k is listed under only one of its settlements\n" unless $h->{$a} && $h->{$b} }
    return (\%land, \%strait, \%name);
}

# read_passes() -> [ { id, x, y, routes => [...] }, ... ]
sub read_passes {
    my @p; open my $f, '<', "$DIR/passes.txt" or die "passes.txt: $!";
    while (<$f>) { next if /^#/ || !/\S/; my ($id, $x, $y, @r) = split; push @p, { id => $id, x => $x, y => $y, routes => \@r } }
    return \@p;
}

# connection_segments(\%C, \%land, \%strait, \@passes) -> list of [x1, y1, x2, y2, dashed]
sub connection_segments {
    my ($C, $land, $strait, $passes) = @_; my %via; for my $p (@$passes) { $via{$_} = $p for @{ $p->{routes} } }
    my @s;
    for my $e (sort keys %$land) { my ($a, $b) = split /-/, $e; my ($x1, $y1) = @{ $C->{$a} }; my ($x2, $y2) = @{ $C->{$b} };
        if (my $p = $via{$e}) { push @s, [$x1, $y1, $p->{x}, $p->{y}, 0], [$p->{x}, $p->{y}, $x2, $y2, 0] } else { push @s, [$x1, $y1, $x2, $y2, 0] } }
    for my $e (sort keys %$strait) { my ($a, $b) = split /-/, $e; push @s, [ @{ $C->{$a} }, @{ $C->{$b} }, 1 ] }
    return @s;
}

# read_countries() -> (\%countryOfSettlement, \%countryName)
sub read_countries {
    my (%country, %cname);
    open my $f, '<', "$ROOT/docs/plan/countries-with-letter-names-and-numbers-for-settlements-in-them.txt" or die $!;
    while (<$f>) { next unless /^(\w+) (.+?) ([\d,]+)\s*$/; my ($code, $name) = (uc $1, $2); $cname{$code} = $name; $country{$_} = $code for split /,/, $3 }
    return (\%country, \%cname);
}

# Mountain peak symbol (apex at x,y): triangle 30 wide, 26 tall, lit/shaded faces, snow cap, dark outline.
our ($MTN_W, $MTN_H) = (30, 26);
our @MTN_OUT = (95, 65, 40); our @MTN_LIT = (196, 170, 136); our @MTN_SHADE = (150, 118, 86);
our @MTN_SNOW = (252, 252, 252); our @MTN_SNOWS = (214, 220, 228);
sub mountain_inside { my ($ax, $ay, $x, $y, $grow) = @_; my ($hw, $h) = ($MTN_W / 2, $MTN_H);
    return 0 if $y > $ay + $h + $grow || $y < $ay - $grow * 2;
    my $t = ($y - $ay) / $h; return abs($x - $ax) <= $hw * $t + $grow * (1 + $hw / $h) }
sub draw_mountain {
    my ($I, $W, $H, $ax, $ay) = @_; ($ax, $ay) = ($ax + 0.5, $ay + 0.5); my ($hw, $h) = ($MTN_W / 2, $MTN_H); my $split = $ax + $MTN_W * 0.06;
    for my $y (int($ay) - 3 .. int($ay + $h) + 2) { for my $x (int($ax - $hw) - 2 .. int($ax + $hw) + 2) { next if $x < 0 || $y < 0 || $x >= $W || $y >= $H;
        my $n = 0; my @acc = (0, 0, 0);
        for my $sy (0 .. 3) { for my $sx (0 .. 3) { my ($px, $py) = ($x + ($sx + 0.5) / 4, $y + ($sy + 0.5) / 4);
            next unless mountain_inside($ax, $ay, $px, $py, 0.9); my @c;
            if (!mountain_inside($ax, $ay, $px, $py, -0.7)) { @c = @MTN_OUT }
            else { my $t = ($py - $ay) / $h; my $lit = $px < $ax + ($split - $ax) * $t;
                @c = $t < 0.34 + 0.05 * sin(($px - $ax) * 1.3) ? ($lit ? @MTN_SNOW : @MTN_SNOWS) : ($lit ? @MTN_LIT : @MTN_SHADE) }
            $acc[$_] += $c[$_] for 0 .. 2; $n++ } }
        next unless $n; my $al = $n / 16; my $p = $I->[$y][$x];
        $I->[$y][$x] = [ (map { int($acc[$_] / $n * $al + $p->[$_] * (1 - $al) + 0.5) } 0 .. 2), 255 ] } }
}

1;
