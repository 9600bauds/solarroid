const isValidSpaceEntity = (entity) => {
  //Contains "wall" anywhere
  return entity.name.search("wall") >= 0
}

module.exports = {
  isValidSpaceEntity
};
