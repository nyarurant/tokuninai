const { Client, GatewayIntentBits, PermissionsBitField, ActivityType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const token = require("./set.json").token;
const deeplApiKey = require('./set.json').deepl; 
const path = require('path');
const fs = require('fs');
const lock = require('./lock.json');
const axios = require('axios'); 

const loginDataPath = path.join(__dirname, 'loginData.json');

function loadLoginData() {
  try {
    if (!fs.existsSync(loginDataPath)) {
      fs.writeFileSync(loginDataPath, JSON.stringify({}, null, 2));
    }
    return JSON.parse(fs.readFileSync(loginDataPath, 'utf8'));
  } catch (error) {
    console.log('loginData.jsonが見つからないか、解析できません。新しいファイルを作成します。');
    return {};
  }
}

function saveLoginData(data) {
  fs.writeFileSync(loginDataPath, JSON.stringify(data, null, 2));
}


let loginData = loadLoginData();

const countDir = path.join(__dirname, 'count');
if (!fs.existsSync(countDir)) {
  fs.mkdirSync(countDir);
}

const today = new Date().toISOString().split('T')[0];
const countFilePath = path.join(countDir, `${today}.json`);

let countchat = {};
try {
  countchat = JSON.parse(fs.readFileSync(countFilePath, 'utf8'));
} catch (error) {
  console.log(`${today}.jsonが見つからないか、解析できません。新しいファイルを作成します。`);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers, 
  ],
});

async function log(message) {
  if (message === undefined || message === null || message === '') {
    console.log('空のメッセージは送信できません');
    return;
  }

  const logChannel = client.channels.cache.get('1338440772890132500');
  if (logChannel) {
    try {
      await logChannel.send({ content: `\`\`\`\n${String(message)}\n\`\`\`` });
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
    }
  }
  console.log(message);
}

const prefix = '.';

client.once('ready', async () => {
  log(`${client.user.tag} ok`);
  client.user.setActivity('たわし様の奴隷', { 
    type: ActivityType.Streaming,
    url: 'https://www.twitch.tv/nacho_dayo'
  });

  const guild = client.guilds.cache.get('1214506829514801182');

  for (const userId in loginData) {
    try {
      const user = await client.users.fetch(userId);
      const globalName = user.globalName || user.username;
      const consecutiveLogins = loginData[userId]?.consecutiveLogins || 0;

      const newNickname = `${globalName} 🍁${consecutiveLogins}`;
      const member = await guild.members.fetch(userId);
      await member.setNickname(newNickname);
      console.log(`ニックネームを更新しました: ${newNickname}`);
    } catch (error) {
      console.error(`ユーザー ${userId} の更新中にエラーが発生しました:`, error);
    }
  }
});

client.on('guildMemberAdd', member => {
  const channel = member.guild.channels.cache.get('ウェルカムチャンネルのID');
  if (channel) {
    channel.send(`ようこそ！${member}さん\nhttps://discord.com/channels/1214506829514801182/1332756437163708527 で自己紹介\nhttps://discord.com/channels/1214506829514801182/1332772679387840552 で認証をしてね！`);
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const userId = message.author.id;
  const today = new Date().toISOString().split('T')[0];

  if (!loginData[userId]) {
    loginData[userId] = {
      lastLogin: '',
      consecutiveLogins: 0,
      totalLogins: 0
    };
  }

  if (loginData[userId].lastLogin !== today) {
    loginData[userId].totalLogins++;

    const yesterday = new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0];
    if (loginData[userId].lastLogin === yesterday) {
      loginData[userId].consecutiveLogins++;
    } else {
      loginData[userId].consecutiveLogins = 1;
    }

    loginData[userId].lastLogin = today;
    saveLoginData(loginData);
  }

  if (message.content === `${prefix}logindata`) {
    const userLoginData = loginData[userId];
    message.reply(`あなたのログインデータ:\n連続ログイン: ${userLoginData.consecutiveLogins}日\n累計ログイン: ${userLoginData.totalLogins}日`);
  }

  if (!countchat[userId]) {
    countchat[userId] = 0;
  }

  countchat[userId]++;

  fs.writeFileSync(countFilePath, JSON.stringify(countchat, null, 2));

  if (message.content.startsWith(prefix + "timeout")) {
    const args = message.content.slice((prefix + "timeout").length).trim().split(/ +/);
    await handleTimeout(message, args);
  }

  if (message.content.startsWith(prefix + "lock")) {
    if(lock[message.channel.id]) {
        await handleChannelUnlock(message);
    } else {
        await handleChannelLock(message);
    }
  }

  if (message.content.startsWith(prefix + "translate")) {
    const args = message.content.slice((prefix + "translate").length).trim().split(/ +/);
    const targetLang = args.shift();
    const text = args.join(' ');
    await handleTranslate(message, text, targetLang);
  }

  if (message.content.startsWith(prefix + "deepl")) {
    if (message.reference) {
      const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
      await handleTranslate(message, repliedMessage.content, 'JA');
    } else {
      message.reply('翻訳するメッセージにリプライしてください。');
    }
  }

  
  if (message.content === '.lbchat') {
    const sortedUsers = Object.entries(countchat)
      .sort(([, countA], [, countB]) => countB - countA)
      .map(([userId, count], index) => ({ rank: index + 1, userId, count }));

    const embed = new EmbedBuilder()
      .setTitle('今日のメッセージ数ランキング')
      .setColor('#c71585')
      .setDescription(sortedUsers.map(user => `**${user.rank}位** <@${user.userId}>: ${user.count} メッセージ`).join('\n'));

    message.channel.send({ embeds: [embed] });
  }

  if (message.content.startsWith('.infoforum')) {
    const args = message.content.split(' ');
    if (args.length !== 2) {
      return message.reply('使用方法: .infoforum <チャンネルID>');
    }

    const channelId = args[1];
    try {
      const channel = await client.channels.fetch(channelId);

      const activeThreads = await channel.threads.fetchActive();
      const archivedThreads = await channel.threads.fetchArchived();

      const allThreads = [...activeThreads.threads.values(), ...archivedThreads.threads.values()];

      const threadDetails = await Promise.all(allThreads.map(async thread => {
        const owner = await client.users.fetch(thread.ownerId);
        return {
          id: thread.id,
          name: thread.name,
          createdAt: thread.createdAt,
          ownerId: thread.ownerId,
          ownerName: owner.displayName,
          messageCount: thread.messageCount,
          memberCount: thread.memberCount
        };
      }));

      let currentPage = 0;
      const totalPages = threadDetails.length;

      const generateThreadInfo = (page) => {
        const thread = threadDetails[page];
        return `ID: ${thread.id}\nスレッド名: ${thread.name}\n作成日時: ${thread.createdAt}\nオーナー: ${thread.ownerName} (${thread.ownerId})\nメッセージ数: ${thread.messageCount}\nメンバー数: ${thread.memberCount}`;
      };

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('prev')
            .setLabel('前へ')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('next')
            .setLabel('次へ')
            .setStyle(ButtonStyle.Primary)
        );

      const threadInfo = generateThreadInfo(currentPage);
      const infoMessage = await message.reply({ content: `スレッド情報 (スレッド ${currentPage + 1}/${totalPages}):\n\`\`\`\n${threadInfo}\n\`\`\``, components: [row] });

      const filter = i => i.customId === 'prev' || i.customId === 'next';
      const collector = infoMessage.createMessageComponentCollector({ filter, time: 60000 });

      collector.on('collect', async i => {
        if (i.customId === 'prev' && currentPage > 0) {
          currentPage--;
        } else if (i.customId === 'next' && currentPage < totalPages - 1) {
          currentPage++;
        }

        const newThreadInfo = generateThreadInfo(currentPage);
        await i.update({ content: `スレッド情報 (スレッド ${currentPage + 1}/${totalPages}):\n\`\`\`\n${newThreadInfo}\n\`\`\``, components: [row] });
      });

    } catch (error) {
      console.error('エラーが発生しました:', error);
      message.reply('エラーが発生しました。');
    }
  }
});

async function handleTimeout(message, args) {
  if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
    return message.reply('このコマンドを使用する権限がありません。');
  }

  const target = message.mentions.members.first();
  if (!target) {
    return message.reply('タイムアウトするユーザーを指定してください。');
  }

  if (target.roles.highest.position >= message.guild.members.me.roles.highest.position) {
    return message.reply('無理\n-# ロール高すぎ');
  }

  const durationStr = args[1];
  if (!durationStr) {
    return message.reply('タイムアウト時間を指定してください。例: 7d, 24h, 30m');
  }

  const duration = parseDuration(durationStr);
  if (duration === null) {
    return message.reply('有効なタイムアウト時間を指定してください。例: 7d, 24h, 30m');
  }

  try {
    await target.timeout(duration, '規則違反');
    message.reply(`${target.user.tag}を${durationStr}間タイムアウトしました。`);
  } catch (error) {
    if (error.code === 50013) {
      message.reply('権限不足のため、タイムアウトできません。');
    } else {
      log(error);
      message.reply('タイムアウトの設定中にエラーが発生しました。');
    }
  }
}

function parseDuration(durationStr) {
  const match = durationStr.match(/^(\d+)([dhm])$/);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000; 
    case 'm':
      return value * 60 * 1000; 
    default:
      return null;
  }
}

async function handleChannelLock(message) {
  if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply('このコマンドを使用する権限がありません。');
  }

  try {
    await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
      SendMessages: false
    });
    lock[message.channel.id] = true;
    fs.writeFileSync(path.join(__dirname, 'lock.json'), JSON.stringify(lock, null, 2)); 
    message.reply('チャンネルをロックしました。');
  } catch (error) {
    log(error);
    message.reply('チャンネルのロック中にエラーが発生しました。');
  }
}

async function handleChannelUnlock(message) {
  if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
    return message.reply('このコマンドを使用する権限がありません。');
  }

  try {
    await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
      SendMessages: true
    });
    lock[message.channel.id] = false;
    fs.writeFileSync(path.join(__dirname, 'lock.json'), JSON.stringify(lock, null, 2));
    message.reply('チャンネルのロックを解除しました。');
  } catch (error) {
    console.error(error);
    message.reply('チャンネルのロック解除中にエラーが発生しました。');
  }
}

async function handleTranslate(message, text, targetLang) {
  try {
    const response = await axios.post('https://api-free.deepl.com/v2/translate', null, {
      params: {
        auth_key: deeplApiKey,
        text: text,
        target_lang: targetLang.toUpperCase()
      }
    });
    const translatedText = response.data.translations[0].text;
    message.reply(`翻訳結果:\n ${translatedText}`);
  } catch (error) {
    log(message);
    message.reply('翻訳中にエラーが発生しました。');
  }
}

let lastCheckedDate = new Date().toISOString().split('T')[0];

setInterval(() => {
  const currentDate = new Date().toISOString().split('T')[0];
  if (currentDate !== lastCheckedDate) {
    lastCheckedDate = currentDate;
    const yesterdayFilePath = path.join(countDir, `${lastCheckedDate}.json`);
    let yesterdayCountchat = {};
    try {
      yesterdayCountchat = JSON.parse(fs.readFileSync(yesterdayFilePath, 'utf8'));
    } catch (error) {
      console.log(`${lastCheckedDate}.jsonが見つからないか、解析できません。`);
      return;
    }

    const sortedUsers = Object.entries(yesterdayCountchat)
      .sort(([, countA], [, countB]) => countB - countA)
      .map(([userId, count], index) => ({ rank: index + 1, userId, count }));

    const embed = new EmbedBuilder()
      .setTitle('昨日のメッセージ数ランキング')
      .setColor('#c71585')
      .setDescription(sortedUsers.map(user => `**${user.rank}位** <@${user.userId}>: ${user.count} メッセージ`).join('\n'));

    const channel = client.channels.cache.get('1335664187564626020');
    if (channel) {
      channel.send({ embeds: [embed] });
    } else {
      console.log('指定されたチャンネルが見つかりません。');
    }
  }
}, 30 * 1000); 

client.login(token).catch(err => {
  console.error("Failed to login:", err); 
});
