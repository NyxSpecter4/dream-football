package com.example.dreamfootball.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.dreamfootball.data.model.JerseyTheme
import com.example.dreamfootball.domain.CitiesData
import com.example.dreamfootball.ui.components.JerseyBadge
import com.example.dreamfootball.ui.components.StadiumHeroCard
import com.example.dreamfootball.ui.components.TurfFieldBackground
import com.example.dreamfootball.ui.theme.DarkSurface
import com.example.dreamfootball.ui.theme.DarkSurfaceBorder
import com.example.dreamfootball.ui.theme.DarkSurfaceVariant
import com.example.dreamfootball.ui.theme.GreenPrimary
import com.example.dreamfootball.ui.theme.TextMuted
import com.example.dreamfootball.ui.theme.TextPrimary
import com.example.dreamfootball.ui.theme.TextSecondary

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SetupScreen(
    onBack: () -> Unit,
    onSubmit: (name: String, shortTag: String, jersey: JerseyTheme, city: String, stadium: String) -> Unit
) {
    var teamName by remember { mutableStateOf("Lone Star Blitz") }
    var shortTag by remember { mutableStateOf("BLZ") }
    var selectedCity by remember { mutableStateOf(CitiesData.CITIES.first()) }
    var selectedJersey by remember { mutableStateOf(JerseyTheme.MIDNIGHT) }

    TurfFieldBackground {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(20.dp)
                .verticalScroll(rememberScrollState())
        ) {
            // Header
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                IconButton(
                    onClick = onBack,
                    modifier = Modifier.testTag("back_button")
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = TextPrimary
                    )
                }
                Spacer(modifier = Modifier.width(8.dp))
                Column {
                    Text(
                        text = "BUILD YOUR FRANCHISE",
                        color = TextPrimary,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    )
                    Text(
                        text = "Choose your city, stadium & team identity",
                        color = TextSecondary,
                        fontSize = 12.sp
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Live Stadium Card Preview
            StadiumHeroCard(
                city = selectedCity.city,
                stadium = selectedCity.stadium,
                clubName = teamName.ifBlank { "Your Franchise" },
                jersey = selectedJersey
            )

            Spacer(modifier = Modifier.height(20.dp))

            // Team Name and Short Tag Inputs
            Row(modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(
                    value = teamName,
                    onValueChange = { teamName = it },
                    label = { Text("Franchise Name") },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary,
                        focusedBorderColor = GreenPrimary,
                        unfocusedBorderColor = DarkSurfaceBorder,
                        focusedContainerColor = DarkSurface,
                        unfocusedContainerColor = DarkSurface
                    ),
                    singleLine = true,
                    modifier = Modifier
                        .weight(1f)
                        .testTag("team_name_input")
                )
                Spacer(modifier = Modifier.width(12.dp))
                OutlinedTextField(
                    value = shortTag,
                    onValueChange = { if (it.length <= 4) shortTag = it.uppercase() },
                    label = { Text("Tag") },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary,
                        focusedBorderColor = GreenPrimary,
                        unfocusedBorderColor = DarkSurfaceBorder,
                        focusedContainerColor = DarkSurface,
                        unfocusedContainerColor = DarkSurface
                    ),
                    singleLine = true,
                    modifier = Modifier
                        .width(90.dp)
                        .testTag("team_tag_input")
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Jersey Selection
            Text(
                text = "JERSEY COLORS",
                color = TextSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                letterSpacing = 1.sp
            )
            Spacer(modifier = Modifier.height(10.dp))

            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                JerseyTheme.entries.forEach { jersey ->
                    val isSelected = jersey == selectedJersey
                    Surface(
                        color = if (isSelected) DarkSurfaceVariant else DarkSurface,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .border(
                                width = if (isSelected) 2.dp else 1.dp,
                                color = if (isSelected) GreenPrimary else DarkSurfaceBorder,
                                shape = RoundedCornerShape(10.dp)
                            )
                            .clickable { selectedJersey = jersey }
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            JerseyBadge(jersey = jersey, sizeDp = 16)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = jersey.label,
                                color = if (isSelected) TextPrimary else TextSecondary,
                                fontSize = 12.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // City Selection
            Text(
                text = "HOME CITY & STADIUM",
                color = TextSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                letterSpacing = 1.sp
            )
            Spacer(modifier = Modifier.height(10.dp))

            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                CitiesData.CITIES.forEach { city ->
                    val isSelected = city.id == selectedCity.id
                    Surface(
                        color = if (isSelected) GreenPrimary.copy(alpha = 0.15f) else DarkSurface,
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier
                            .border(
                                width = if (isSelected) 1.5.dp else 1.dp,
                                color = if (isSelected) GreenPrimary else DarkSurfaceBorder,
                                shape = RoundedCornerShape(8.dp)
                            )
                            .clickable {
                                selectedCity = city
                                selectedJersey = city.jersey
                            }
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                        ) {
                            if (isSelected) {
                                Icon(
                                    imageVector = Icons.Default.Check,
                                    contentDescription = null,
                                    tint = GreenPrimary,
                                    modifier = Modifier.size(14.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                            }
                            Text(
                                text = city.city,
                                color = if (isSelected) GreenPrimary else TextPrimary,
                                fontSize = 12.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(30.dp))

            // Submit Button
            Button(
                onClick = {
                    onSubmit(
                        teamName.ifBlank { "Lone Star Blitz" },
                        shortTag.ifBlank { "BLZ" },
                        selectedJersey,
                        selectedCity.city,
                        selectedCity.stadium
                    )
                },
                colors = ButtonDefaults.buttonColors(containerColor = GreenPrimary),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .testTag("enter_draft_button")
            ) {
                Text(
                    text = "ENTER DRAFT ROOM",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    letterSpacing = 1.sp
                )
            }
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}
