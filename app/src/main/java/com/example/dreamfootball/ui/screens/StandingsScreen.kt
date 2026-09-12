package com.example.dreamfootball.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.dreamfootball.data.model.GameState
import com.example.dreamfootball.domain.LeagueEngine
import com.example.dreamfootball.ui.components.JerseyBadge
import com.example.dreamfootball.ui.components.TurfFieldBackground
import com.example.dreamfootball.ui.components.fmtPts
import com.example.dreamfootball.ui.theme.DarkBg
import com.example.dreamfootball.ui.theme.DarkSurface
import com.example.dreamfootball.ui.theme.DarkSurfaceBorder
import com.example.dreamfootball.ui.theme.DarkSurfaceVariant
import com.example.dreamfootball.ui.theme.GoldAccent
import com.example.dreamfootball.ui.theme.GreenPrimary
import com.example.dreamfootball.ui.theme.TextMuted
import com.example.dreamfootball.ui.theme.TextPrimary
import com.example.dreamfootball.ui.theme.TextSecondary

@Composable
fun StandingsScreen(
    state: GameState,
    onBack: () -> Unit
) {
    val standings = LeagueEngine.calculateStandings(state.teams, state.results, state.week - 1)
    val bracket = state.playoffBracket

    TurfFieldBackground {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp)
        ) {
            // Header
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                IconButton(onClick = onBack, modifier = Modifier.testTag("standings_back_button")) {
                    Icon(imageVector = Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                }
                Spacer(modifier = Modifier.width(6.dp))
                Column {
                    Text(
                        text = "LEAGUE STANDINGS",
                        color = TextPrimary,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Top 4 teams advance to the playoffs (Week 8)",
                        color = TextMuted,
                        fontSize = 11.sp
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Playoff Bracket Card (if in playoffs or complete)
            if (bracket != null) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = DarkSurface),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, GoldAccent, RoundedCornerShape(12.dp))
                        .padding(bottom = 14.dp)
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(imageVector = Icons.Default.EmojiEvents, contentDescription = null, tint = GoldAccent, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "PLAYOFF BRACKET",
                                color = GoldAccent,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace,
                                letterSpacing = 1.sp
                            )
                        }
                        Spacer(modifier = Modifier.height(10.dp))

                        val tMap = state.teams.associateBy { it.id }
                        Text(
                            text = "SEMIFINAL 1: ${tMap[bracket.semiA.homeId]?.short} vs ${tMap[bracket.semiA.awayId]?.short}",
                            color = TextPrimary,
                            fontSize = 12.sp,
                            fontFamily = FontFamily.Monospace
                        )
                        Text(
                            text = "SEMIFINAL 2: ${tMap[bracket.semiB.homeId]?.short} vs ${tMap[bracket.semiB.awayId]?.short}",
                            color = TextPrimary,
                            fontSize = 12.sp,
                            fontFamily = FontFamily.Monospace
                        )

                        if (bracket.finalMatchup != null) {
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "CHAMPIONSHIP: ${tMap[bracket.finalMatchup.homeId]?.short} vs ${tMap[bracket.finalMatchup.awayId]?.short}",
                                color = GoldAccent,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }

                        if (bracket.championId != null) {
                            Spacer(modifier = Modifier.height(6.dp))
                            val champ = tMap[bracket.championId]
                            Text(
                                text = "🏆 CHAMPION: ${champ?.name ?: "TBD"}",
                                color = GreenPrimary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp
                            )
                        }
                    }
                }
            }

            // Table Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Text("#", color = TextMuted, fontSize = 11.sp, modifier = Modifier.width(24.dp))
                Text("TEAM", color = TextMuted, fontSize = 11.sp, modifier = Modifier.weight(1f))
                Text("W-L", color = TextMuted, fontSize = 11.sp, modifier = Modifier.width(50.dp))
                Text("PF", color = TextMuted, fontSize = 11.sp, modifier = Modifier.width(56.dp))
            }

            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier.weight(1f)
            ) {
                itemsIndexed(standings) { index, row ->
                    val team = state.teams.find { it.id == row.teamId }
                    val isUser = row.teamId == "you"
                    val isPlayoffCut = index == 3

                    Column {
                        Surface(
                            color = if (isUser) DarkSurfaceVariant else DarkSurface,
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .border(
                                    width = if (isUser) 1.5.dp else 1.dp,
                                    color = if (isUser) GreenPrimary else DarkSurfaceBorder,
                                    shape = RoundedCornerShape(8.dp)
                                )
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp)
                            ) {
                                Text(
                                    text = "${index + 1}",
                                    color = if (index < 4) GreenPrimary else TextMuted,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.width(24.dp)
                                )

                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.weight(1f)
                                ) {
                                    if (team != null) {
                                        JerseyBadge(jersey = team.jersey, sizeDp = 12)
                                        Spacer(modifier = Modifier.width(8.dp))
                                    }
                                    Text(
                                        text = team?.name ?: row.teamId,
                                        color = if (isUser) GreenPrimary else TextPrimary,
                                        fontSize = 13.sp,
                                        fontWeight = if (isUser) FontWeight.Bold else FontWeight.Medium,
                                        maxLines = 1
                                    )
                                }

                                Text(
                                    text = "${row.wins}-${row.losses}",
                                    color = TextPrimary,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace,
                                    modifier = Modifier.width(50.dp)
                                )

                                Text(
                                    text = fmtPts(row.pointsFor),
                                    color = TextSecondary,
                                    fontSize = 12.sp,
                                    fontFamily = FontFamily.Monospace,
                                    modifier = Modifier.width(56.dp)
                                )
                            }
                        }

                        if (isPlayoffCut) {
                            Spacer(modifier = Modifier.height(6.dp))
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(1.dp)
                                        .background(GoldAccent.copy(alpha = 0.5f))
                                )
                                Text(
                                    text = "  PLAYOFF CUT LINE  ",
                                    color = GoldAccent,
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace,
                                    letterSpacing = 0.5.sp
                                )
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(1.dp)
                                        .background(GoldAccent.copy(alpha = 0.5f))
                                )
                            }
                            Spacer(modifier = Modifier.height(2.dp))
                        }
                    }
                }
            }
        }
    }
}
