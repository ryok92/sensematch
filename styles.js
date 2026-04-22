import { StyleSheet, Platform } from 'react-native';

export default StyleSheet.create({
  container: {
    flexGrow: 1,
    // 背景色はLinearGradientで指定するため透明または削除
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingBottom: 40,
  },

  logo: {
    fontSize: 40,
    fontWeight: '300', // 少し細くして洗練された印象に
    color: '#FFFFFF',  // 白文字
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.1)', // 薄い影で可読性アップ
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  tagline: {
    fontSize: 16,
    color: '#FFFFFF', // 白文字
    marginBottom: 40,
    opacity: 0.9,
  },

  appleButton: {
    width: '85%',
    height: 50,
    marginBottom: 15,
  },

  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '85%',
    height: 50,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 0, // ボーダーは削除してスッキリさせる
  },

  socialIcon: {
    marginRight: 10,
  },

  googleButtonText: {
    color: '#333333',
    fontSize: 16,
    fontWeight: 'bold',
  },

  dividerText:{
    color: '#FFFFFF', // 白文字
    fontSize: 14,
    marginBottom: 20,
    fontWeight: '500',
  },

  // --- トグルボタン（ログイン/新規登録）のスタイル変更 ---
  toggleContainer:{
    flexDirection:'row',
    backgroundColor: 'rgba(255, 255, 255, 0.25)', // 半透明の白背景
    borderRadius: 25,
    width: '85%',
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)', // 薄い白枠線
  },

  activeToggle:{
    flex:1,
    backgroundColor: '#FFFFFF', // 選択中は真っ白
    paddingVertical: 12,
    alignItems: 'center',
  },

  inactiveToggle:{
    flex:1,
    backgroundColor: 'transparent', // 非選択中は透明
    paddingVertical: 12,
    alignItems: 'center',
  },

  activeToggleText:{
    color: '#5B86E5', // 青系のテキスト（テーマカラーに合わせる）
    fontWeight: 'bold',
  },

  inactiveToggleText:{
    color: '#FFFFFF', // 白文字
    fontWeight: 'bold',
  },

  // --- 入力フォーム ---
  input:{
    width:'85%',
    height:50,
    backgroundColor: '#FFFFFF', // 真っ白な背景
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 15,
    color: '#333333',
  },

  passwordContainer:{
    flexDirection:'row',
    alignItems:'center',
    width:'85%',
    height:50,
    backgroundColor: '#FFFFFF', // 真っ白な背景
    borderRadius: 10,
    marginBottom: 10,
    paddingHorizontal: 15,
  },

  inputPassword:{
    flex:1,
    height:'100%',
    fontSize:16,
    color: '#333333',
  },

  eyeIcon:{
    // 必要であれば調整
  },

  strengthIndicatorContainer:{
    width:'85%',
    marginBottom:15,
  },

  strengthBarBase:{
    width:'100%',
    height:6,
    backgroundColor: 'rgba(255,255,255,0.4)', // 背景に合わせて半透明
    borderRadius:3,
    overflow:'hidden',
  },

  strengthBarFill:{
    height:'100%',
    borderRadius:3,
  },

  strengthText:{
    fontSize:12,
    marginTop:5,
    textAlign:'left',
    // colorはLoginScreen側で制御
  },

  mainButton:{
    width:'85%',
    backgroundColor: '#407ec9', // 画像に近い少し落ち着いたブルー
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },

  mainButtonText:{
    color:'#FFFFFF',
    fontSize:18,
    fontWeight:'bold',
  },

  forgotPassword:{
    color: '#FFFFFF', // 白文字
    fontSize: 14,
    textDecorationLine: 'underline', // リンクっぽく下線を追加しても良い
  },
});