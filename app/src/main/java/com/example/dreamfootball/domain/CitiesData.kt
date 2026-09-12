package com.example.dreamfootball.domain

import com.example.dreamfootball.data.model.CityClub
import com.example.dreamfootball.data.model.JerseyTheme

object CitiesData {
    val CITIES: List<CityClub> = listOf(
        CityClub("dal", "Dallas", "Trinity Field", "Lone Star", JerseyTheme.MIDNIGHT, "DAL"),
        CityClub("kc", "Kansas City", "Arrow Field", "Midwest", JerseyTheme.CRIMSON, "KC"),
        CityClub("gb", "Green Bay", "Frozen Tundra", "Titletown", JerseyTheme.PINE, "GB"),
        CityClub("sf", "San Francisco", "Fog Bay Field", "Pacific", JerseyTheme.SUNSET, "SF"),
        CityClub("phi", "Philadelphia", "Broad St Field", "Liberty", JerseyTheme.EMERALD, "PHI"),
        CityClub("det", "Detroit", "Motor Yard", "Rust Belt", JerseyTheme.STEEL, "DET"),
        CityClub("buf", "Buffalo", "Lake Effect Park", "Orchard", JerseyTheme.ROYAL, "BUF"),
        CityClub("mia", "Miami", "Biscayne Field", "South Beach", JerseyTheme.GOLD, "MIA"),
        CityClub("bal", "Baltimore", "Harbor Field", "Chesapeake", JerseyTheme.MIDNIGHT, "BAL"),
        CityClub("hou", "Houston", "Bayou Dome", "Space City", JerseyTheme.ROYAL, "HOU"),
        CityClub("chi", "Chicago", "Windy Grid", "Lakefront", JerseyTheme.STEEL, "CHI"),
        CityClub("den", "Denver", "Mile High Yard", "High Country", JerseyTheme.SUNSET, "DEN"),
        CityClub("pit", "Pittsburgh", "Three Rivers Field", "Steel City", JerseyTheme.GOLD, "PIT"),
        CityClub("sea", "Seattle", "Emerald Sound", "Rain City", JerseyTheme.EMERALD, "SEA"),
        CityClub("cin", "Cincinnati", "Queen City Yard", "Ohio", JerseyTheme.CRIMSON, "CIN"),
        CityClub("min", "Minneapolis", "Twin Lakes Field", "North Star", JerseyTheme.ROYAL, "MIN")
    )

    fun filter(query: String): List<CityClub> {
        val q = query.trim().lowercase()
        if (q.isEmpty()) return CITIES
        return CITIES.filter {
            it.city.lowercase().contains(q) ||
            it.tag.lowercase().contains(q) ||
            it.stadium.lowercase().contains(q) ||
            it.nfl.lowercase().contains(q)
        }
    }
}
