const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require("discord.js");

const fs = require("fs");

// =========================
// CONFIG
// =========================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const CURRENCY = "MØK";
const FILE = "./economy.json";

// =========================
// ECONOMY DATABASE
// =========================

let economy = {};

if (fs.existsSync(FILE)) {
  try {
    economy = JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    economy = {};
  }
}

function save() {
  fs.writeFileSync(FILE, JSON.stringify(economy, null, 2));
}

function getBalance(id) {
  if (!economy[id]) economy[id] = 0;
  return economy[id];
}

// =========================
// COMMANDS
// =========================

const commands = [

  // PROFILE
  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("عرض بروفايلك الاقتصادي"),

  // BALANCE
  new SlashCommandBuilder()
    .setName("balance")
    .setDescription("عرض رصيدك"),

  // PAY
  new SlashCommandBuilder()
    .setName("pay")
    .setDescription("تحويل العملات")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("العضو الذي تريد التحويل له")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("المبلغ")
        .setMinValue(1)
        .setRequired(true)
    ),

  // ADD
  new SlashCommandBuilder()
    .setName("add")
    .setDescription("إضافة عملات لعضو")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator.toString()
    )
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("المبلغ")
        .setMinValue(1)
        .setRequired(true)
    ),

  // REMOVE
  new SlashCommandBuilder()
    .setName("remove")
    .setDescription("سحب عملات من عضو")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator.toString()
    )
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("المبلغ")
        .setMinValue(1)
        .setRequired(true)
    )

].map(command => command.toJSON());

// =========================
// CLIENT
// =========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

// =========================
// READY
// =========================

client.once("ready", async () => {

  console.log(`MØK Economy Online: ${client.user.tag}`);

  const rest = new REST({
    version: "10"
  }).setToken(TOKEN);

  try {

    await rest.put(
      Routes.applicationGuildCommands(
        CLIENT_ID,
        GUILD_ID
      ),
      {
        body: commands
      }
    );

    console.log("Commands registered!");

  } catch (error) {

    console.error("Command registration error:", error);

  }

});

// =========================
// INTERACTIONS
// =========================

client.on("interactionCreate", async interaction => {

  if (!interaction.isChatInputCommand()) return;

  const id = interaction.user.id;

  getBalance(id);

  // =========================
  // PROFILE
  // =========================

  if (interaction.commandName === "profile") {

    const user = interaction.user;
    const balance = getBalance(user.id);

    const avatar = user.displayAvatarURL({
      extension: "png",
      size: 512
    });

    const embed = new EmbedBuilder()
      .setAuthor({
        name: `${user.username} Profile`,
        iconURL: avatar
      })
      .setThumbnail(avatar)
      .setDescription(
        `## 💰 بروفايل MØK\n` +
        `**👤 العضو:** ${user}\n\n` +
        `**💵 الرصيد**\n` +
        `\`${balance.toLocaleString()} ${CURRENCY}\``
      )
      .addFields(
        {
          name: "💰 Balance",
          value: `\`${balance.toLocaleString()} ${CURRENCY}\``,
          inline: true
        },
        {
          name: "🪙 Currency",
          value: `\`${CURRENCY}\``,
          inline: true
        }
      )
      .setFooter({
        text: "MØK Economy"
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed]
    });
  }

  // =========================
  // BALANCE
  // =========================

  if (interaction.commandName === "balance") {

    const balance = getBalance(id);

    const embed = new EmbedBuilder()
      .setAuthor({
        name: `${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setDescription(
        `💰 **رصيدك الحالي**\n\n` +
        `# \`${balance.toLocaleString()} ${CURRENCY}\``
      )
      .setFooter({
        text: "MØK Economy"
      });

    return interaction.reply({
      embeds: [embed]
    });
  }

  // =========================
  // PAY
  // =========================

  if (interaction.commandName === "pay") {

    const user = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");

    if (user.bot) {
      return interaction.reply({
        content: "❌ لا يمكنك التحويل إلى بوت.",
        ephemeral: true
      });
    }

    if (user.id === id) {
      return interaction.reply({
        content: "❌ لا يمكنك التحويل لنفسك.",
        ephemeral: true
      });
    }

    if (getBalance(id) < amount) {
      return interaction.reply({
        content:
          `❌ رصيدك غير كافٍ.\n` +
          `رصيدك الحالي: **${getBalance(id).toLocaleString()} ${CURRENCY}**`,
        ephemeral: true
      });
    }

    getBalance(user.id);

    economy[id] -= amount;
    economy[user.id] += amount;

    save();

    const embed = new EmbedBuilder()
      .setAuthor({
        name: "MØK Economy",
        iconURL: interaction.user.displayAvatarURL()
      })
      .setDescription(
        `💸 **تم تحويل الرصيد بنجاح**\n\n` +
        `👤 **من:** ${interaction.user}\n` +
        `📥 **إلى:** ${user}\n` +
        `💰 **المبلغ:** \`${amount.toLocaleString()} ${CURRENCY}\``
      )
      .addFields(
        {
          name: "💵 رصيدك الجديد",
          value: `\`${economy[id].toLocaleString()} ${CURRENCY}\``,
          inline: true
        }
      )
      .setFooter({
        text: "MØK Economy"
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed]
    });
  }

  // =========================
  // ADD
  // =========================

  if (interaction.commandName === "add") {

    const user = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");

    getBalance(user.id);

    economy[user.id] += amount;

    save();

    const embed = new EmbedBuilder()
      .setDescription(
        `➕ **تم إضافة العملات**\n\n` +
        `👤 **العضو:** ${user}\n` +
        `💰 **المبلغ:** \`${amount.toLocaleString()} ${CURRENCY}\`\n` +
        `💵 **الرصيد الجديد:** \`${economy[user.id].toLocaleString()} ${CURRENCY}\``
      )
      .setFooter({
        text: `بواسطة ${interaction.user.username}`
      });

    return interaction.reply({
      embeds: [embed]
    });
  }

  // =========================
  // REMOVE
  // =========================

  if (interaction.commandName === "remove") {

    const user = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");

    getBalance(user.id);

    economy[user.id] = Math.max(
      0,
      economy[user.id] - amount
    );

    save();

    const embed = new EmbedBuilder()
      .setDescription(
        `➖ **تم سحب العملات**\n\n` +
        `👤 **العضو:** ${user}\n` +
        `💰 **المبلغ:** \`${amount.toLocaleString()} ${CURRENCY}\`\n` +
        `💵 **الرصيد الجديد:** \`${economy[user.id].toLocaleString()} ${CURRENCY}\``
      )
      .setFooter({
        text: `بواسطة ${interaction.user.username}`
      });

    return interaction.reply({
      embeds: [embed]
    });
  }

});

// =========================
// LOGIN
// =========================

client.login(TOKEN);
