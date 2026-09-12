package com.example.dreamfootball.domain

import com.example.dreamfootball.data.model.Player
import com.example.dreamfootball.data.model.Position

object PlayersData {
    val ALL_PLAYERS: List<Player> = listOf(
        // QBs
        Player("p-mahomes", "Patrick Mahomes", Position.QB, "KC", bye = 6, ovr = 98, boom = 0.65f, durability = 0.98f),
        Player("p-jallen", "Josh Allen", Position.QB, "BUF", bye = 12, ovr = 97, boom = 0.72f, durability = 0.95f),
        Player("p-ljackson", "Lamar Jackson", Position.QB, "BAL", bye = 14, ovr = 96, boom = 0.80f, durability = 0.92f),
        Player("p-jhurts", "Jalen Hurts", Position.QB, "PHI", bye = 5, ovr = 93, boom = 0.60f, durability = 0.94f),
        Player("p-jburrow", "Joe Burrow", Position.QB, "CIN", bye = 12, ovr = 92, boom = 0.58f, durability = 0.88f),
        Player("p-cjstroud", "C.J. Stroud", Position.QB, "HOU", bye = 14, ovr = 91, boom = 0.55f, durability = 0.95f),
        Player("p-jdaniels", "Jayden Daniels", Position.QB, "WAS", bye = 14, ovr = 90, boom = 0.75f, durability = 0.90f),
        Player("p-bpurdy", "Brock Purdy", Position.QB, "SF", bye = 9, ovr = 88, boom = 0.50f, durability = 0.93f),
        Player("p-jlove", "Jordan Love", Position.QB, "GB", bye = 10, ovr = 87, boom = 0.62f, durability = 0.91f),
        Player("p-kray", "Kyler Murray", Position.QB, "ARI", bye = 11, ovr = 86, boom = 0.68f, durability = 0.89f),
        Player("p-dprescott", "Dak Prescott", Position.QB, "DAL", bye = 7, ovr = 86, boom = 0.54f, durability = 0.90f),
        Player("p-tlawrence", "Trevor Lawrence", Position.QB, "JAX", bye = 12, ovr = 83, boom = 0.48f, durability = 0.92f),

        // RBs
        Player("p-cmc", "Christian McCaffrey", Position.RB, "SF", bye = 9, ovr = 99, boom = 0.82f, durability = 0.85f),
        Player("p-brobinson", "Bijan Robinson", Position.RB, "ATL", bye = 12, ovr = 96, boom = 0.74f, durability = 0.96f),
        Player("p-bhall", "Breece Hall", Position.RB, "NYJ", bye = 12, ovr = 95, boom = 0.76f, durability = 0.92f),
        Player("p-sbarkley", "Saquon Barkley", Position.RB, "PHI", bye = 5, ovr = 95, boom = 0.70f, durability = 0.90f),
        Player("p-jgibbs", "Jahmyr Gibbs", Position.RB, "DET", bye = 5, ovr = 93, boom = 0.78f, durability = 0.93f),
        Player("p-dhenry", "Derrick Henry", Position.RB, "BAL", bye = 14, ovr = 92, boom = 0.65f, durability = 0.97f),
        Player("p-kwilliams", "Kyren Williams", Position.RB, "LAR", bye = 6, ovr = 91, boom = 0.62f, durability = 0.88f),
        Player("p-jtaylor", "Jonathan Taylor", Position.RB, "IND", bye = 14, ovr = 90, boom = 0.68f, durability = 0.87f),
        Player("p-tachane", "De'Von Achane", Position.RB, "MIA", bye = 6, ovr = 89, boom = 0.88f, durability = 0.82f),
        Player("p-jacobs", "Josh Jacobs", Position.RB, "GB", bye = 10, ovr = 88, boom = 0.55f, durability = 0.91f),
        Player("p-kamara", "Alvin Kamara", Position.RB, "NO", bye = 12, ovr = 87, boom = 0.64f, durability = 0.89f),
        Player("p-kwalker", "Kenneth Walker III", Position.RB, "SEA", bye = 10, ovr = 86, boom = 0.66f, durability = 0.87f),
        Player("p-jcook", "James Cook", Position.RB, "BUF", bye = 12, ovr = 86, boom = 0.60f, durability = 0.94f),
        Player("p-imix", "Joe Mixon", Position.RB, "HOU", bye = 14, ovr = 85, boom = 0.52f, durability = 0.89f),
        Player("p-dmont", "David Montgomery", Position.RB, "DET", bye = 5, ovr = 84, boom = 0.50f, durability = 0.92f),
        Player("p-conner", "James Conner", Position.RB, "ARI", bye = 11, ovr = 83, boom = 0.58f, durability = 0.84f),

        // WRs
        Player("p-jjefferson", "Justin Jefferson", Position.WR, "MIN", bye = 6, ovr = 98, boom = 0.84f, durability = 0.94f),
        Player("p-clamb", "CeeDee Lamb", Position.WR, "DAL", bye = 7, ovr = 97, boom = 0.80f, durability = 0.96f),
        Player("p-jchase", "Ja'Marr Chase", Position.WR, "CIN", bye = 12, ovr = 97, boom = 0.85f, durability = 0.93f),
        Player("p-arsb", "Amon-Ra St. Brown", Position.WR, "DET", bye = 5, ovr = 96, boom = 0.68f, durability = 0.97f),
        Player("p-thill", "Tyreek Hill", Position.WR, "MIA", bye = 6, ovr = 95, boom = 0.88f, durability = 0.92f),
        Player("p-ajbrown", "A.J. Brown", Position.WR, "PHI", bye = 5, ovr = 94, boom = 0.78f, durability = 0.91f),
        Player("p-ncollins", "Nico Collins", Position.WR, "HOU", bye = 14, ovr = 93, boom = 0.82f, durability = 0.89f),
        Player("p-mhj", "Marvin Harrison Jr.", Position.WR, "ARI", bye = 11, ovr = 91, boom = 0.77f, durability = 0.95f),
        Player("p-gwilson", "Garrett Wilson", Position.WR, "NYJ", bye = 12, ovr = 91, boom = 0.70f, durability = 0.96f),
        Player("p-mnabers", "Malik Nabers", Position.WR, "NYG", bye = 11, ovr = 90, boom = 0.80f, durability = 0.91f),
        Player("p-pnacua", "Puka Nacua", Position.WR, "LAR", bye = 6, ovr = 90, boom = 0.74f, durability = 0.86f),
        Player("p-dlondon", "Drake London", Position.WR, "ATL", bye = 12, ovr = 89, boom = 0.65f, durability = 0.94f),
        Player("p-dsmith", "DeVonta Smith", Position.WR, "PHI", bye = 5, ovr = 88, boom = 0.68f, durability = 0.93f),
        Player("p-dmoore", "DJ Moore", Position.WR, "CHI", bye = 7, ovr = 87, boom = 0.66f, durability = 0.95f),
        Player("p-deebo", "Deebo Samuel", Position.WR, "SF", bye = 9, ovr = 86, boom = 0.75f, durability = 0.85f),
        Player("p-metcalf", "DK Metcalf", Position.WR, "SEA", bye = 10, ovr = 86, boom = 0.72f, durability = 0.94f),
        Player("p-terry", "Terry McLaurin", Position.WR, "WAS", bye = 14, ovr = 86, boom = 0.65f, durability = 0.96f),
        Player("p-pico", "George Pickens", Position.WR, "PIT", bye = 9, ovr = 85, boom = 0.78f, durability = 0.93f),
        Player("p-waddle", "Jaylen Waddle", Position.WR, "MIA", bye = 6, ovr = 85, boom = 0.72f, durability = 0.88f),
        Player("p-flowers", "Zay Flowers", Position.WR, "BAL", bye = 14, ovr = 84, boom = 0.68f, durability = 0.95f),

        // TEs
        Player("p-tkelce", "Travis Kelce", Position.TE, "KC", bye = 6, ovr = 94, boom = 0.65f, durability = 0.95f),
        Player("p-laporta", "Sam LaPorta", Position.TE, "DET", bye = 5, ovr = 93, boom = 0.70f, durability = 0.94f),
        Player("p-tmcbride", "Trey McBride", Position.TE, "ARI", bye = 11, ovr = 92, boom = 0.62f, durability = 0.95f),
        Player("p-mandrews", "Mark Andrews", Position.TE, "BAL", bye = 14, ovr = 91, boom = 0.68f, durability = 0.88f),
        Player("p-gkittle", "George Kittle", Position.TE, "SF", bye = 9, ovr = 91, boom = 0.75f, durability = 0.87f),
        Player("p-bbowers", "Brock Bowers", Position.TE, "LV", bye = 10, ovr = 90, boom = 0.72f, durability = 0.93f),
        Player("p-dengram", "Evan Engram", Position.TE, "JAX", bye = 12, ovr = 87, boom = 0.55f, durability = 0.90f),
        Player("p-dferguson", "Jake Ferguson", Position.TE, "DAL", bye = 7, ovr = 85, boom = 0.52f, durability = 0.92f),
        Player("p-dknox", "Dalton Kincaid", Position.TE, "BUF", bye = 12, ovr = 84, boom = 0.58f, durability = 0.91f),
        Player("p-pitts", "Kyle Pitts", Position.TE, "ATL", bye = 12, ovr = 83, boom = 0.70f, durability = 0.90f),

        // Ks
        Player("p-aubrey", "Brandon Aubrey", Position.K, "DAL", bye = 7, ovr = 94, boom = 0.45f, durability = 0.99f),
        Player("p-jtucker", "Justin Tucker", Position.K, "BAL", bye = 14, ovr = 92, boom = 0.35f, durability = 0.99f),
        Player("p-hbutker", "Harrison Butker", Position.K, "KC", bye = 6, ovr = 90, boom = 0.38f, durability = 0.98f),
        Player("p-keve", "Ka'imi Fairbairn", Position.K, "HOU", bye = 14, ovr = 88, boom = 0.42f, durability = 0.98f),
        Player("p-jelliott", "Jake Elliott", Position.K, "PHI", bye = 5, ovr = 87, boom = 0.40f, durability = 0.98f),
        Player("p-cbojorquez", "Cameron Dicker", Position.K, "LAC", bye = 5, ovr = 86, boom = 0.38f, durability = 0.98f),
        Player("p-boswell", "Chris Boswell", Position.K, "PIT", bye = 9, ovr = 86, boom = 0.40f, durability = 0.98f),
        Player("p-mcpherson", "Evan McPherson", Position.K, "CIN", bye = 12, ovr = 85, boom = 0.45f, durability = 0.98f),

        // DSTs
        Player("p-dst-sf", "San Francisco 49ers", Position.DST, "SF", bye = 9, ovr = 93, boom = 0.55f, durability = 0.95f),
        Player("p-dst-bal", "Baltimore Ravens", Position.DST, "BAL", bye = 14, ovr = 92, boom = 0.58f, durability = 0.95f),
        Player("p-dst-cle", "Cleveland Browns", Position.DST, "CLE", bye = 10, ovr = 90, boom = 0.62f, durability = 0.95f),
        Player("p-dst-nyj", "New York Jets", Position.DST, "NYJ", bye = 12, ovr = 89, boom = 0.56f, durability = 0.95f),
        Player("p-dst-dal", "Dallas Cowboys", Position.DST, "DAL", bye = 7, ovr = 88, boom = 0.65f, durability = 0.94f),
        Player("p-dst-pit", "Pittsburgh Steelers", Position.DST, "PIT", bye = 9, ovr = 88, boom = 0.60f, durability = 0.95f),
        Player("p-dst-kc", "Kansas City Chiefs", Position.DST, "KC", bye = 6, ovr = 87, boom = 0.50f, durability = 0.95f),
        Player("p-dst-buf", "Buffalo Bills", Position.DST, "BUF", bye = 12, ovr = 86, boom = 0.54f, durability = 0.95f),
        Player("p-dst-hou", "Houston Texans", Position.DST, "HOU", bye = 14, ovr = 85, boom = 0.58f, durability = 0.95f),
        Player("p-dst-den", "Denver Broncos", Position.DST, "DEN", bye = 14, ovr = 84, boom = 0.60f, durability = 0.95f)
    )

    private val playerMap: Map<String, Player> by lazy {
        ALL_PLAYERS.associateBy { it.id }
    }

    fun getPlayer(id: String): Player {
        return playerMap[id] ?: Player(id, "Unknown Player", Position.WR, "FA", 0, 75)
    }
}
