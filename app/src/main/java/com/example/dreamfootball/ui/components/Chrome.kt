package com.example.dreamfootball.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.dreamfootball.data.model.JerseyTheme
import com.example.dreamfootball.data.model.Player
import com.example.dreamfootball.data.model.Position
import com.example.dreamfootball.domain.AuctionEngine
import com.example.dreamfootball.domain.ScoringEngine
import com.example.dreamfootball.ui.theme.DarkBg
import com.example.dreamfootball.ui.theme.DarkSurface
import com.example.dreamfootball.ui.theme.DarkSurfaceBorder
import com.example.dreamfootball.ui.theme.DarkSurfaceVariant
import com.example.dreamfootball.ui.theme.FieldTurf
import com.example.dreamfootball.ui.theme.FieldTurfStripe
import com.example.dreamfootball.ui.theme.GreenPrimary
import com.example.dreamfootball.ui.theme.TextMuted
import com.example.dreamfootball.ui.theme.TextPrimary
import com.example.dreamfootball.ui.theme.TextSecondary
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToInt

fun fmtMoney(amount: Int): String {
    val dollars = amount.toLong() * 1000L
    val absDollars = abs(dollars)
    return when {
        absDollars >= 1_000_000 -> {
            val m = dollars / 1_000_000.0
            val rounded = (m * 10).roundToInt() / 10.0
            if (rounded == rounded.toLong().toDouble()) {
                "$${rounded.toLong()}M"
            } else {
                String.format(Locale.US, "$%.1fM", rounded)
            }
        }
        absDollars >= 1000 -> "$${(dollars / 1000)}K"
        else -> "$$dollars"
    }
}

fun fmtPts(pts: Float): String {
    return String.format(Locale.US, "%.1f", pts)
}

fun jerseyNumberForPlayer(id: String): Int {
    var h = 2166136261L
    for (ch in id) {
        h = h xor ch.code.toLong()
        h = (h * 16777619L) and 0xFFFFFFFFL
    }
    return (1 + (h % 99)).toInt()
}

@Composable
fun TurfFieldBackground(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(DarkBg)
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val stripeHeight = 60.dp.toPx()
            var y = 0f
            var index = 0
            while (y < size.height) {
                val color = if (index % 2 == 0) FieldTurf else FieldTurfStripe
                drawRect(
                    color = color.copy(alpha = 0.45f),
                    topLeft = Offset(0f, y),
                    size = androidx.compose.ui.geometry.Size(size.width, stripeHeight)
                )
                // Yard line hash
                drawLine(
                    color = Color.White.copy(alpha = 0.04f),
                    start = Offset(0f, y),
                    end = Offset(size.width, y),
                    strokeWidth = 1.dp.toPx()
                )
                y += stripeHeight
                index++
            }
        }
        content()
    }
}

@Composable
fun JerseyBadge(
    jersey: JerseyTheme,
    modifier: Modifier = Modifier,
    sizeDp: Int = 12
) {
    Box(
        modifier = modifier
            .size(sizeDp.dp)
            .clip(CircleShape)
            .background(Color(jersey.primaryHex))
            .border(1.dp, Color(jersey.secondaryHex), CircleShape)
    )
}

@Composable
fun PositionChip(
    pos: Position,
    modifier: Modifier = Modifier
) {
    Surface(
        color = DarkSurfaceVariant,
        shape = RoundedCornerShape(4.dp),
        modifier = modifier
    ) {
        Text(
            text = pos.name,
            color = TextMuted,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
        )
    }
}

@Composable
fun PlayerAvatar(
    player: Player,
    modifier: Modifier = Modifier
) {
    val number = jerseyNumberForPlayer(player.id)
    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .size(36.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(DarkSurfaceVariant)
            .border(1.dp, DarkSurfaceBorder, RoundedCornerShape(8.dp))
    ) {
        Text(
            text = "$number",
            color = GreenPrimary,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace
        )
    }
}

@Composable
fun PlayerRow(
    player: Player,
    modifier: Modifier = Modifier,
    trailingText: String? = null,
    active: Boolean = false,
    onClick: (() -> Unit)? = null
) {
    val proj = ScoringEngine.calculateProjection(player)
    val mv = AuctionEngine.marketValue(player.id)

    val rowModifier = modifier
        .fillMaxWidth()
        .clip(RoundedCornerShape(10.dp))
        .background(if (active) DarkSurfaceVariant else DarkSurface)
        .border(
            width = if (active) 1.5.dp else 1.dp,
            color = if (active) GreenPrimary else DarkSurfaceBorder,
            shape = RoundedCornerShape(10.dp)
        )
        .then(if (onClick != null) Modifier.clickable { onClick() } else Modifier)
        .padding(horizontal = 12.dp, vertical = 10.dp)

    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = rowModifier
    ) {
        PlayerAvatar(player = player)
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = player.name,
                    color = TextPrimary,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp
                )
                Spacer(modifier = Modifier.width(6.dp))
                PositionChip(pos = player.pos)
            }
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = "${player.nfl} · Bye ${player.bye} · ${fmtPts(proj.mid)} proj · OVR ${player.ovr}",
                color = TextMuted,
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace
            )
        }
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = trailingText ?: fmtMoney(mv),
            color = if (trailingText != null) TextPrimary else GreenPrimary,
            fontWeight = FontWeight.Bold,
            fontSize = 13.sp,
            fontFamily = FontFamily.Monospace
        )
    }
}

@Composable
fun StadiumHeroCard(
    city: String,
    stadium: String,
    clubName: String,
    jersey: JerseyTheme,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(130.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(Color(jersey.primaryHex).copy(alpha = 0.9f))
            .border(1.dp, Color(jersey.secondaryHex).copy(alpha = 0.5f), RoundedCornerShape(14.dp))
            .padding(16.dp)
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            // Draw yard lines in hero
            val step = size.width / 8f
            for (i in 1..7) {
                val x = i * step
                drawLine(
                    color = Color.White.copy(alpha = 0.08f),
                    start = Offset(x, 0f),
                    end = Offset(x, size.height),
                    strokeWidth = 2f
                )
            }
        }
        Column(modifier = Modifier.align(Alignment.BottomStart)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                JerseyBadge(jersey = jersey, sizeDp = 14)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = city.uppercase(Locale.US),
                    color = Color.White.copy(alpha = 0.75f),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    letterSpacing = 1.sp
                )
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = clubName,
                color = Color.White,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = stadium,
                color = Color.White.copy(alpha = 0.85f),
                fontSize = 12.sp,
                fontFamily = FontFamily.SansSerif
            )
        }
    }
}
