const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const { OpenAI } = require("openai");
const { defineSecret } = require("firebase-functions/params");

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const openAiApiKey = defineSecret("OPENAI_API_KEY");

exports.onMatchCreated = functions.firestore
  .document('matches/{matchId}')
  .onCreate(async (snap, context) => {
    const matchData = snap.data();
    if (!matchData || !matchData.users) {
      logger.error('...');
      return null;
    }
    const userIds = matchData.users;

    if (!userIds || userIds.length !== 2) {
      logger.error('Invalid match data: users array id missing or incorrect');
      return null;
    }

    const [uid1, uid2] = userIds;

    try {
      await db.runTransaction(async (transaction) => {
        const user1Ref = db.collection('users').doc(uid1);
        const user2Ref = db.collection('users').doc(uid2);

        const [user1Snap, user2Snap] = await Promise.all([
          transaction.get(user1Ref), transaction.get(user2Ref)
        ]);

        if (!user1Snap.exists || !user2Snap.exists) {
          throw new Error('One of the users does not exists');
        }

        const u1 = user1Snap.data();
        const u2 = user2Snap.data();

        transaction.update(snap.ref, {
          userSnapshots: {
            [uid1]: {
              displayName: u1.displayName || 'No Name',
              photoURL: u1.photoURL || '',
              photoStoragePath: u1.photoStoragePath || '',
              age: u1.birthDate ? calculateAge(u1.birthDate) : '--',
              gender: u1.gender || '',
              mainPhotoStatus: u1.mainPhotoStatus || 'pending'
            },
            [uid2]: {
              displayName: u2.displayName || 'No Name',
              photoURL: u2.photoURL || '',
              photoStoragePath: u2.photoStoragePath || '',
              age: u2.birthDate ? calculateAge(u2.birthDate) : '--',
              gender: u2.gender || '',
              mainPhotoStatus: u2.mainPhotoStatus || 'pending'
            }
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        transaction.delete(user1Ref.collection('receivedLikes').doc(uid2));
        transaction.delete(user1Ref.collection('sentLikes').doc(uid2));

        transaction.delete(user2Ref.collection('receivedLikes').doc(uid1));
        transaction.delete(user2Ref.collection('sentLikes').doc(uid1));

        logger.info(`Match cleanup success for ${uid1} and ${uid2}`);
      });
    } catch (error) {
      logger.error('Transaction failure in onMatchCreated:', error);
    }
    return null;
  });

exports.onUserUpdated = functions.firestore
  .document('users/{uid}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const uid = context.params.uid;

    const isNameChanged = before.displayName !== after.displayName;
    const isPhotoChanged = before.photoURL !== after.photoURL;
    const isStatusChanged = before.mainPhotoStatus !== after.mainPhotoStatus;
    const isStoragePathChanged = before.photoStoragePath !== after.photoStoragePath;

    if (!isNameChanged && !isPhotoChanged && !isStatusChanged && !isStoragePathChanged) {
      return null;
    }

    logger.info(`User ${uid} profile changed. Syncing matches...`);

    try {
      const matchesQuery = await db.collection('matches')
        .where('users', 'array-contains', uid)
        .get();

      const batch = db.batch();

      if (!matchesQuery.empty) {
        matchesQuery.docs.forEach((doc) => {
          const matchRef = doc.ref;
          const updateData = {};

          if (isNameChanged) updateData[`userSnapshots.${uid}.displayName`] = after.displayName || 'No Name';
          if (isPhotoChanged) updateData[`userSnapshots.${uid}.photoURL`] = after.photoURL || '';
          if (isStatusChanged) updateData[`userSnapshots.${uid}.mainPhotoStatus`] = after.mainPhotoStatus || 'pending';
          if (isStoragePathChanged) updateData[`userSnapshots.${uid}.photoStoragePath`] = after.photoStoragePath || '';

          updateData['updatedAt'] = admin.firestore.FieldValue.serverTimestamp();

          batch.update(matchRef, updateData);
        });
      }

      const mySentLikesQuery = await db.collection('users').doc(uid).collection('sentLikes').get();
      mySentLikesQuery.docs.forEach((doc) => {
        const targetUserId = doc.id;
        const targetReceivedLikeRef = db.collection('users').doc(targetUserId).collection('receivedLikes').doc(uid);
        const updateData = {};
        if (isNameChanged) updateData[`fromUserSnapshot.displayName`] = after.displayName || 'No Name';
        if (isPhotoChanged) updateData[`fromUserSnapshot.photoURL`] = after.photoURL || '';
        if (isStatusChanged) updateData[`fromUserSnapshot.mainPhotoStatus`] = after.mainPhotoStatus || 'pending';
        if (isStoragePathChanged) updateData[`fromUserSnapshot.photoStoragePath`] = after.photoStoragePath || '';
        if (isLocationChanged) updateData[`fromUserSnapshot.location`] = after.location || ''; // ★ [MODIFIED]: locationを追加

        batch.update(targetReceivedLikeRef, updateData);
      })

      const myReceivedLikesQuery = await db.collection('users').doc(uid).collection('receivedLikes').get();
      myReceivedLikesQuery.docs.forEach((doc) => {
        const fromUserId = doc.id;
        const fromSentLikeRef = db.collection('users').doc(fromUserId).collection('sentLikes').doc(uid);
        const updateData = {};
        if (isNameChanged) updateData[`targetUserSnapshot.displayName`] = after.displayName || 'No Name';
        if (isPhotoChanged) updateData[`targetUserSnapshot.photoURL`] = after.photoURL || '';
        if (isStatusChanged) updateData[`targetUserSnapshot.mainPhotoStatus`] = after.mainPhotoStatus || 'pending';
        if (isStoragePathChanged) updateData[`targetUserSnapshot.photoStoragePath`] = after.photoStoragePath || '';
        if (isLocationChanged) updateData[`targetUserSnapshot.location`] = after.location || ''; // ★ [MODIFIED]: locationを追加

        batch.update(fromSentLikeRef, updateData);
      });

      await batch.commit();
      logger.info(`Succsrssfully synced ${matchesQuery.size} matches for user ${uid}`);
    } catch (error) {
      logger.error('Error syncing user profile to matches:', error);
    }
    return null;
  });

exports.onLikeSent = functions.firestore.document('users/{uid}/sentLikes/{targetId}').onCreate(async (snap, context) => {
  const data = snap.data();
  const fromUserId = context.params.uid;
  const targetuserId = context.params.targetId;

  logger.info(`Like sent from ${fromuserId} to ${targerUserId}. Syncing to receivedLikes...`);

  try {
    const fromUserDoc = await db.collection('users').doc(fromUserId).get();
    const fromUserData = fromUserDoc.data() || {};

    const receivedLikesRef = db.collection('users').doc(targetUserId).collection('receivedLikes').doc(fromUserId);

    await receivedLikesRef.set({
      fromUserId: fromUserId,
      createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
      questionAnswer: data.answer || '',
      isRead: false,
      fromUserSnapshot: {
        displayName: fromUserData.displayName || 'No Name',
        photoURL: fromUserData.photoURL || '',
        photoStoragePath: fromUserData.photoStoragePath || '',
        age: fromUserId.birthDate ? calculateAge(fromUserData.birthDate) : '--',
        gender: fromUserData.gender || '',
        mainPhotoStatus: fromUserData.mainPhotoStatus || 'pending',
        location: fromUserData.location || ''
      }
    });

    logger.info(`Successfully created receivedLike for ${targetUserId}`);
  } catch (error) {
    logger.error('Error syncing like to receivedLikes:', error);
  }
  return null;
});

function calculateAge(birthDate) {
  if (!birthDate) return '--';
  const birth = birthDate.toDate ? birthDate.toDate() : new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age;
}




exports.generateSenseVector = onDocumentWritten(
  {
    document: "users/{uid}/senseData/profile",
    region: "asia-northeast1", // 日本リージョン
    secrets: [openAiApiKey],   // シークレットキーへのアクセス権限
  },
  async (event) => {
    if (!event.data) return;

    const change = event.data;
    const afterData = change.after.data();

    if (!afterData) return;

    const shouldGenerateVector = afterData.shouldGenerateVector === true;

    if (!shouldGenerateVector) return;

    const afterProfiles = afterData.senseProfiles || {};
    const profileTexts = Object.values(afterProfiles);

    const validTexts = profileTexts.filter(text => typeof text === "string" && text.trim() !== "");

    if (validTexts.length === 0) {
      await change.after.ref.update({ shouldGenerateVector: false });
      return;
    }

    const combinedProfileText = validTexts.join(" ");
    logger.info(`ベクトル化するテキスト文字数: ${combinedProfileText.length}文字`);

    try {
      const openai = new OpenAI({
        apiKey: openAiApiKey.value(),
      });

      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: combinedProfileText,
      });

      const embeddingVector = response.data[0].embedding;

      await change.after.ref.update({
        senseVector: embeddingVector,
        vectorUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        shouldGenerateVector: false,
      });

      logger.info(`ユーザー ${event.params.uid} のベクトル生成と保存が完了しました！`);

    } catch (error) {
      logger.error("エラーが発生しました:", error);
      await change.after.ref.update({ shouldGenerateVector: false });
    }
  }
);