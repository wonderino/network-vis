/* TODO :
 - [] search 기능 분리
 - [] history 기능 분리
 - [] history 한줄에만 표현되도록 맥시멈 정하기
  - [] 상단 영역 비워두기 (arc로 그리기?)
 - [] 중복 코드 단일화 (draw node - draw ego)
 - [] 마우스 오버시 기타 정보 추가하기
 - [] 컬러 코드 수정 : 특정 기준 이하 색상 통일
 - [] 컬러 코드 변경 옵션 추가
 - [] 배경 원 애니메이션 - 대쉬 어레이 값 변경
*/
d3.egoNetworks = function module() {
  var attrs = {
    width: 880,
    height:880,
    egoIndex:0,
    nodeKey:'user_id',
    degreeMin:1,
    degreeMax:10,
    valueKey:'value', //null 이면 갯수로 센다.
    sortKey:'value', // sortKey가 ordinal 인지 linear 인지
    sortType:'number',
    sortAscending : true,
    sortUnit : 1,
    sortMap : {'follow':'팔로잉', 'followed_by':'팔로워', 'mutual':'맞팔'},
    nameKey:'ent_name',
    teamKey:'team',
    jobKey:'occupation',
    companyKey:'company',
    isDirected : false,
    hierKeys : ['team', 'company'],
    colorKey : 'company',
    pictureKey : ['profile_picture'],
    colors: ['rgb(235, 62, 69)', 'rgb(26, 175, 145)', 'rgb(161, 97, 185)', 'rgb(233, 208, 28)']
  }
  var margin = {top:120, right:160, bottom:120, left:160};
  var debug = false, sorted = true, durationUnit = 400, profile_size = 100;
  var nodeSize = d3.scale.linear().clamp(true)
    , color = d3.scale.ordinal()
    , radiusSize = d3.scale.linear().clamp(true)
    , sortRadius = d3.scale.ordinal();
  var innerWidth, innerHeight, netRadius;
  var nodeAndLink, indexKr, indexEn;
  var svg, detailDiv, sequenceDiv,sequence = [];
  var defaultColor = '#c9c9c9';
  Math.radians = function(degrees) {
    return degrees * Math.PI / 180;
  };
  Math.degrees = function(radians) {
    return radians * 180 / Math.PI;
  };
  Math.TWO_PI = Math.PI*2;
  Math.HALF_PI = Math.PI*.5;

  var exports = function (_selection) {
    _selection.each(function(_data) {
      if(!svg) {
        linkAndNode = _data;
        d3.select(this).style('width', attrs.width + 'px')
          .style('height', attrs.height + 'px')
        innerWidth = attrs.width - margin.left - margin.right;
        innerHeight = attrs.height - margin.top - margin.bottom;

        var minRadius = innerWidth*.5*.8;
        var maxRadius =  innerWidth*.5;
        radiusSize.domain([attrs.degreeMin, attrs.degreeMax])
          .rangeRound([minRadius, maxRadius])

        sequenceDiv = d3.select(this)
          .append('div')
          .attr('class', 'sequence')

        svg = d3.select(this).append('svg')
          .attr('width', attrs.width)
          .attr('height', attrs.height)
            .append('g')
          .attr('transform', d3.svg.transform().translate([margin.left, margin.top]))
        svg.append('g')
          .attr('class', 'background');
        detailDiv = d3.select(this)
            .append('div')
            .attr('class', 'detail')

      }
      setColorKey(linkAndNode);
      nodeSize.domain([attrs.degreeMin,attrs.degreeMax])
        .rangeRound([innerWidth*.02, innerWidth*.225]);
      setSearchIndex();
      svg.datum(linkAndNode)
        .call(netInit)
        .on('click', function() {
          exports.sort();
        })
      sequenceDiv.datum(sequence)
        .call(updateSequence);
    })
  }
  function updateDetail(_selection) {
    _selection.each(function(_data) {
      var selection = d3.select(this);
      var profile = selection.selectAll('.profile')
        .data(function(d){return [d.ego]});

      profile.enter().append('div')
        .attr('class','profile');
      var _appendProfileElements = function(_selection, className, keyName) {
        _selection.each(function() {
          var name = d3.select(this).selectAll('.' + className)
            .data(function(d){return [d[keyName]]});
          name.enter().append('div')
              .attr('class', className);
          name.text(function(d){return d});
        })
        return _selection;
      }

      profile.call(_appendProfileElements,'name', attrs.nameKey)
        .call(_appendProfileElements,'team', attrs.teamKey)
        .call(_appendProfileElements,'occupation', attrs.jobKey)
        .call(_appendProfileElements,'company', attrs.companyKey)

      var stat = selection.selectAll('.stat')
        .data(function(d){return d.stat})

      var statEnter = stat.enter().append('div')
        .attr('class', 'stat')
      statEnter.append('div')
        .attr('class', 'key')
      statEnter.append('div')
        .attr('class', 'value')
      stat.select('.key').text(function(d){return attrs.sortMap[d.key] ? attrs.sortMap[d.key]:d.key});
      stat.select('.value').text(function(d){return d3.sum(d.values, function(dd){return dd.values})});
        stat.exit().remove();
      var ul =  stat.selectAll('ul')
        .data(function(d){return [d.values]})
      ul.enter().append('ul');


      var row = ul.selectAll('li.row')
        .data(function(d){return d})
      var rowEnter = row.enter().append('li')
        .attr('class', 'row')
      rowEnter.append('div')
        .attr('class', 'key')
      rowEnter.append('div')
        .attr('class', 'value')
      row.select('.key')
        .text(function(d){return d.key})
      row.select('.value')
        .text(function(d){return d.values})

      //TODO : update rows;
      row.exit().remove();

    });

    return _selection;
  }

  function imgExists(url, callback) {
    try {
      var http = new Image();
      http.onload = function() {callback(true)};
      http.onerror = function() {callback(false)};
      http.src = url;
    } catch(err) {
      callback(false);
    }
  }

  function search(query) {
    var pre = indexKr.search(query);
    if (pre.length == 0 )pre = indexEn.search(query);
    var result = pre.map(function(m) {
      return findNodes(m.ref)[0]
    })
    return result;
  }
  function findNodes(key) {
    return linkAndNode.nodes.filter(function(node){
      return key === node[attrs.nodeKey];
    })
  }
  function setSearchIndex() {
    var keys = ['team', 'user_name','real_name','ent_name']
    indexKr = lunr(function() {
      var self = this;
      self.use(lunr.jp);
      keys.forEach(function(k,i) {
        self.field(k, {boost:(i+1)*10});
      })
      self.ref(attrs.nodeKey);
    })
    linkAndNode.nodes.forEach(function(n){
      indexKr.add(n);
    })
    indexEn = lunr(function() {
      var self = this;
      keys.forEach(function(k,i) {
        self.field(k, {boost:(i+1)*10});
      })
      self.ref(attrs.nodeKey);
    })
    linkAndNode.nodes.forEach(function(n){
      indexEn.add(n);
    })
  }

  function setColorKey (linkAndNode) {
    var colorExtent = d3.nest()
      .key(function(d){return d[attrs.colorKey]})
      .rollup(function(leaves){return leaves.length})
      .entries(linkAndNode.nodes)
      //d3.set(linkAndNode.nodes.map(function(d){return d[attrs.colorKey]})).values();
    colorExtent.sort(function(a,b){return b.values-a.values});
    color.domain(colorExtent.map(function(d){return d.key}).slice(0, attrs.colors.length))
      .range(attrs.colors);
  }

  function trimValForSort (d) {
    return Math.floor((d.linkToEgo[attrs.sortKey])/attrs.sortUnit) * attrs.sortUnit
  }
  function setSortRadius(egoAndNeighbors) {
    netRadius = radiusSize(egoAndNeighbors.ego.egoDegree);
    if (attrs.sortType == 'number') {
        var sortExtent = d3.extent(egoAndNeighbors.neighbors, function(d) {return trimValForSort(d);})
        sortRadius.domain(d3.range(sortExtent[0], sortExtent[1]+attrs.sortUnit, attrs.sortUnit))
          .rangeRoundPoints(attrs.sortAscending ? [minRadius, radius] : [radius, minRadius]);
    } else {
        var domain = d3.map({})
        egoAndNeighbors.neighbors.forEach(function(d){
          var key = d.linkToEgo[attrs.sortKey];
          if (!domain.has(key)) {
              domain.set(key, 0)
          }
          domain.set(key, domain.get(key)+1);
        })
        domain = domain.entries();
        domain = domain.sort(function(a,b) {return a.value - b.value;})

        sortRadius.domain(domain.map(function(d){return d.key}))
          .rangeRoundPoints(
            attrs.sortAscending ?
            [profile_size*.35 + netRadius / domain.length, netRadius]
          : [netRadius, profile_size*.35 + netRadius / domain.length] )
    }

  }

  function resetEgoAndNeighbors(_selection, egoAndNeighbors) {
    var egoStat = getEgoStat(egoAndNeighbors);
    _selection.call(drawNeighbors, egoAndNeighbors.neighbors)
      .call(drawEgo, egoAndNeighbors.ego);

    detailDiv.datum({ego: egoAndNeighbors.ego, stat:egoStat})
      .call(updateDetail);
    return _selection;
  }

  function updateSequence(_selection) {
    var sequenceLimit = 12;
    var sequence = _selection.selectAll('.node')
      .data(function(d){return d})

    sequence.enter().append('div')
      .attr('class', 'node')
      .text(function(d){return d[attrs.nameKey]})
      .on('click', function(d) {
        var egoAndNeighbors = getEgoAndNeighbors(d[attrs.nodeKey]);
        setSortRadius(egoAndNeighbors);
        svg.call(resetEgoAndNeighbors, egoAndNeighbors);
      })
  }

  function netInit(_selection) {
    _selection.each(function(_data) {
      var selection = d3.select(this);
      var egoAndNeighbors = getEgoAndNeighbors();
      sequence.push(egoAndNeighbors.ego);
      setSortRadius(egoAndNeighbors);
      selection.call(resetEgoAndNeighbors, egoAndNeighbors);
    })
    return _selection;
  }

  function getEgoStat(egoAndNeighbors) {
    var neighbors = egoAndNeighbors.neighbors;
    var neighborNest = d3.nest()
      .key(function(d){return d.linkToEgo.type})
      .key(function(d){return d.neighbor[attrs.colorKey]})
      .rollup(function(leaves){return leaves.length})
      .sortValues(d3.descending)
      .entries(neighbors);

    neighborNest.forEach(function(d1){
      d1.values.sort(function(a,b){return b.values - a.values});
    })
    neighborNest.sort(function(a,b){return d3.sum(b.values, function(d){return d.values}) - d3.sum(a.values, function(d){return d.values})});
    var threshold = 4;
    neighborNest.forEach(function(d) {
      if (d.values.length > threshold) {
        var sum = d.values.slice(threshold).reduce(function(pre, cur){
          return pre + cur.values;
        }, 0)
        d.values = d.values.slice(0, threshold);
        d.values.push({key:'기타', values:sum});
      }
    })
    return neighborNest;
  }

  function getEgoAndNeighbors(egoIndex) {
    egoIndex = egoIndex || attrs.egoIndex;

    var getNeighbors = function (egoIndex, egoNeighbors) {

      var neighbors = [], links = linkAndNode.links, nodes = linkAndNode.nodes;
      links.forEach(function(l) {
        if (egoIndex === l.source) {
          var neighbor = findNode(nodes, l.target)
          if (neighbor[attrs.nameKey] !== '-') { // 공식 계정은 걸러내기
            if (!egoNeighbors) {
              if (l.is_mutual) l.type = 'mutual'
              else l.type = 'follow'
              var n = {neighbor:neighbor, linkToEgo:l}
              n[attrs.nodeKey] = l.target;
              neighbors.push(n);
            } else {
              var egoNeighbor = findNode(egoNeighbors, neighbor[attrs.nodeKey])
              if (egoNeighbor) neighbors.push({linkToEgo:l, neighbor:egoNeighbor})
            }
          }
        } else if (egoIndex === l.target) {
          var neighbor = findNode(nodes, l.source)
          if (neighbor[attrs.nameKey] !== '-') { // 공식 계정은 걸러내기
            if((attrs.isDirected && !l.is_mutual)) {
                if(!egoNeighbors) {
                  l.type = 'followed_by'
                  var n = {neighbor:neighbor, linkToEgo:l}
                  n[attrs.nodeKey] = l.source;
                  neighbors.push(n)
                } else {
                  var egoNeighbor = findNode(egoNeighbors, neighbor[attrs.nodeKey])
                  if (egoNeighbor) neighbors.push({linkToEgo:l, neighbor:egoNeighbor})
                }
            }
          }
        }
      })
      neighbors = neighbors.sort(function(a,b){return a.neighbor[attrs.colorKey].localeCompare(b.neighbor[attrs.colorKey])});
      return neighbors;
    }
    var egoData = findNode(linkAndNode.nodes, egoIndex)//_data.nodes[attrs.egoIndex]
    var neighborsData = getNeighbors(egoIndex)

    neighborsData.forEach(function(a) {
      a.linkToNeighbors = getNeighbors(a.neighbor[attrs.nodeKey],
        neighborsData.map(function(d){return d.neighbor})).map(function(d){return d.linkToEgo});
    });

    if(attrs.valueKey) {
      egoData.egoDegree = 0;
      neighborsData.forEach(function(n) {
        egoData.egoDegree += n.linkToEgo[attrs.valueKey]
      })
    } else {
      egoData.egoDegree = neighborsData.length;
    }
    return {ego:egoData, neighbors:neighborsData}
  }

  function findNode(nodes, value) {
    for (var i = 0; i < nodes.length ; i++) {
      if (nodes[i][attrs.nodeKey] == value) {
        return nodes[i];
      }
    }
    return null;
  }

  function drawEgo(selection, egoData) {
    var ego = selection.selectAll('.ego')
      .data([egoData], function(d){return d[attrs.nodeKey]})

    var egoEnter = ego.enter().append('g')
      .attr('class', 'ego node')
      .attr('transform', d3.svg.transform()
        .translate([innerWidth/2, innerHeight/2])
      );

    var mask = ego.selectAll('.mask')
      .data(function(d){return [d]})

    mask.enter().append('defs')
        .attr('class','.mask')
          .append('clipPath')
        .attr('id', function(d){return 'egoClip-'+d[attrs.nodeKey]})
        .append('circle')
        .attr('r', 0)
        //.style('stroke', function(d){return color(d[attrs.colorKey]);})
    mask.select('clipPath > circle')
      .transition().duration(durationUnit)
      .attr('r', profile_size*.5);

    var image = ego.selectAll('.profile-picture')
      .data(function(d){return [d]})

    image.enter().append('image')
      .attr('class', 'profile-picture')
      .each(function(d){
        var url = d[attrs.pictureKey];
        var self = this;
        imgExists(url, function(exists){
          if (exists){
            d3.select(self)
              .attr('clip-path', function(){return 'url(#egoClip-'+d[attrs.nodeKey]+')'})
              .attr('xlink:href', function(){return url;})
          } else {
            d3.select(self)
              .classed('no-image', false);
          }
        });
      })

    var circle = ego.selectAll('.node-circle')
        .data(function(d){return [d]})
    circle.enter().append('circle')
      .attr('class', 'node-circle')

    circle.transition().duration(durationUnit)
      .attr('r', function(d){return profile_size*.5})
      .style('fill', 'none')
      .style('stroke', function(d){return color.domain().indexOf(d[attrs.colorKey]) >=0 ? color(d[attrs.colorKey]) : defaultColor})

    image.attr('x', -profile_size*.5)
      .attr('y', -profile_size*.5)
      .attr('width', profile_size)
      .attr('height', profile_size)

    egoEnter.append('text')
      .attr('class', 'node-text');

    egoEnter.append('text')
      .attr('class', 'node-sub-text');

    ego.transition().duration(durationUnit)
      .attr('transform', d3.svg.transform()
        .translate([innerWidth/2, innerHeight/2])
      )

    ego.select('.node-text')
      .text(function(d){return d[attrs.nameKey]})
      .attr('transform', null)
      .attr('text-anchor', 'middle')
      .transition().duration(durationUnit)
      .attr('dx', 0)
      .attr('y', 50)
      .attr('dy', '1.35em');
    ego.select('.node-sub-text')
      .text(function(d){return !d[attrs.teamKey] || d[attrs.teamKey]=='-' ? d[attrs.jobKey] : d[attrs.teamKey]})
      .attr('transform', null)
      .attr('text-anchor', 'middle')
      .transition().duration(durationUnit)
      .attr('dx', 0)
      .attr('y', 65)
      .attr('dy', '2em');
    ego.exit().remove();
    return selection;
  }

  function drawNeighbors(selection, neighborsData) {
    var thetaOffset = (sorted ? Math.PI * .20 : 0),
     thetaUnit = (Math.PI*2 - thetaOffset)/ Math.max(1,(neighborsData.length-(sorted ? 1 : 0)));

    var background = selection.select('.background')
      .selectAll('.background-circle')
        .data(function(d){
          return sorted ? sortRadius.domain().map(function(d) {
            return [sortRadius(d),d]
          })
            : [[netRadius]]},
          function(d){return d[0]});

    var backgroundEnter = background.enter().append('g')
      .attr('transform', d3.svg.transform().translate([innerWidth/2, innerHeight/2]))
      .attr('class', 'background-circle')
    background.sort(function(a,b){return b[0]- a[0]})
      .order();

    var circle = backgroundEnter
    .each(function(d) {
      var arc = d3.svg.arc()
        .innerRadius(d[0]+2)
        .outerRadius(null)
        .endAngle(Math.TWO_PI + thetaOffset*.5)
        .startAngle(Math.TWO_PI - thetaOffset*.5);

      d3.select(this).append('circle')
       .attr('r', d[0]);
      d3.select(this).append('path')
        .attr('d', arc);
    });
    //.attr('r', function(d){return d[0]})

    if (sorted) {
      var text = background.selectAll('text') // FIXME : 상단에 쓰기
        .data(function(d){return [d]})
      .enter().append('text')
        .attr('text-anchor','middle')
        .style('opacity', 0)
        .attr('x', 0)
        .attr('dy', '.35em')
        .text(function(d){return attrs.sortMap[d[1]] ? attrs.sortMap[d[1]]:d[1]})

      text.transition().duration(durationUnit)
        .style('opacity', 1)
        .attr('y', function(d){return -d[0]})

    } else {
      background.selectAll('text')
        .remove();
    }

    background.transition()
      .duration(durationUnit)
      .attr('r', function(d){return d})

    background.exit().remove();

    var neighborFunc = function(selection, neighbors, callback) {
      selection.each(function(d) {
        if ('linkToNeighbors' in d) {
          d.linkToNeighbors.forEach(function(l) {
            neighbors.filter(function(n) {
              return ((l.source == n[attrs.nodeKey] || l.target == n[attrs.nodeKey])
                && (n[attrs.nodeKey] !== d[attrs.nodeKey]))
            }).each(callback)
          })
        }
      })
    }

    var neighbors = selection.selectAll('.neighbor.main')
      .data(neighborsData, function(d){return d[attrs.nodeKey]})

    var neighborsEnter = neighbors.enter().append('g')
      .attr('class', 'neighbor node main')
      .each(function(d) {d.x = innerWidth*.5; d.y = innerHeight*.5})
      .attr('transform', d3.svg.transform().translate(function(d,i) {return [d.x, d.y] }))

    neighbors.call(setNeighborInteraction)
      .each(function(d,i) {
        d.theta = thetaOffset*.525 + thetaUnit*i - Math.HALF_PI;
      }).call(setNeighborPos)

    neighbors.transition().delay(durationUnit*.5)
      .duration(durationUnit)
      .style('opacity', 1)
      .attr('transform', d3.svg.transform().translate(function(d,i) {return [d.x, d.y] }))

    var mask = neighbors.selectAll('.mask')
      .data(function(d){return [d]})

    mask.enter().append('defs')
        .attr('class','.mask')
          .append('clipPath')
        .attr('id', function(d){return 'egoClip-'+d.neighbor[attrs.nodeKey]})
        .append('circle')
        .attr('r', 0)
        //.style('stroke', function(d){return color(d[attrs.colorKey]);})
    mask.select('clipPath > circle')
      .transition().duration(durationUnit)
      .attr('r', 25);


    var image = neighbors.selectAll('.profile-picture')
      .data(function(d){return [d]})

    image.enter().append('image')
      .attr('class', 'profile-picture')
      .each(function(d){
        var url = d.neighbor[attrs.pictureKey];
        var self = this;
        imgExists(url, function(exists){
          if (exists){
            d3.select(self)
              .attr('clip-path', function(){return 'url(#egoClip-'+d.neighbor[attrs.nodeKey]+')'})
              .attr('xlink:href', function(){return url;})
          } else {
            d3.select(self)
              .classed('no-image', true);
          }
        });
      })
    image.attr('x', -25)
      .attr('y', -25)
      .attr('width', 50)
      .attr('height', 50)

    var circle = neighbors.selectAll('.node-circle')
        .data(function(d){return [d]})
    circle.enter().append('circle')
      .attr('class', 'node-circle')

    circle.attr('r', function(d){return attrs.valueKey && d.linkToEgo[attrs.valueKey] ? nodeSize(d.linkToEgo[attrs.valueKey]) : 5})
      .style('fill', function(d){return color.domain().indexOf(d.neighbor[attrs.colorKey]) >=0 ? color(d.neighbor[attrs.colorKey]) : defaultColor})

    var text = neighbors.selectAll('.node-text')
      .data(function(d){return [d]})

    text.enter().append('text')
      .attr('class', 'node-text')
      .text(function(d) {return d.neighbor[attrs.nameKey]})

    text.attr('text-anchor', function(d) {
        return (d.theta + Math.HALF_PI)%Math.TWO_PI > Math.PI ? 'end' : 'start';
      })

    text.transition().duration(durationUnit)
      .attr('transform', d3.svg.transform().rotate(function(d){
        return (d.theta + Math.HALF_PI)%Math.TWO_PI > Math.PI ?   Math.degrees(d.theta) + 180 : Math.degrees(d.theta);
        }).translate(function(d) {
          var dx = nodeSize(attrs.valueKey ? d.linkToEgo : 1) + 2;
          return [(d.theta + Math.HALF_PI)%Math.TWO_PI > Math.PI ? -dx : dx, 0]
        }))
      .attr('dx', 0)
      .attr('y', 0)
      .attr('dy', '.35em')

    neighbors.selectAll('.node-sub-text')
      .data(function(d){return [d]})

    text.enter().append('text')
      .attr('class', 'node-sub-text')

    var linkRadius = d3.scale.linear()
      .domain([0, Math.HALF_PI])

    var linkLine = d3.svg.line()
      .x(function(d) { return d.x; })
      .y(function(d) { return d.y; });

    var linkData = []
    neighbors.each(function(d){
      var self = d3.select(this);
      self.call(neighborFunc, neighbors, function(n) {
        // d-n
        var distTheta = (Math.abs(n.theta-d.theta)%(Math.TWO_PI));
        if (distTheta <= Math.HALF_PI) {
          var meanTheta = distTheta*.5 + d.theta;
          if (sorted) {
            var sortValA = d.linkToEgo[attrs.sortKey], sortValB = n.linkToEgo[attrs.sortKey];
            linkRadius.range(
              attrs.sortType === 'number' ? [sortRadius(trimValForSort(sortValA)), sortRadius(trimValForSort(sortValB))] : [sortRadius(sortValA), sortRadius(sortValB)]
            )
          } else {
            linkRadius.range([netRadius*.5, netRadius])
          }
          var r = linkRadius(meanTheta%Math.PI);
          var center = {x: Math.cos(meanTheta)*r + innerWidth*.5
            , y: Math.sin(meanTheta)*r + innerHeight*.5}
          linkData.push([{node:d, x:d.x, y:d.y}, {node:n, x:n.x, y:n.y}])
          //linkData.push([{node:d, x:d.x, y:d.y}, center, {node:n, x:n.x, y:n.y}])
        } else {
          linkData.push([{node:d, x:d.x, y:d.y}, {node:n, x:n.x, y:n.y}])
        }
      });
    })
    neighbors.exit().remove();
    return selection;
  }

  function drawRestNeighbors(_selection, neighborsData) { // _selection == centerNode;
    var thetaUnit = Math.radians(4)
      , midNum = (neighborsData.length -1) *.5
      , midTheta = _selection.datum().theta;

    var neighbors = svg.selectAll('.neighbor.sub')
      .data(neighborsData, function(d){return d[attrs.nodeKey]})

    var neighborsEnter = neighbors.enter().append('g')
      .attr('class', 'neighbor node sub')
    var parent = _selection.datum()
    neighbors.each(function(d,i) {
      var dist = i - midNum;
      d.theta = midTheta + thetaUnit*dist;
    }).call(setNeighborPos, true)
    .style('opacity', 0)
    .attr('transform', d3.svg.transform().translate([parent.x,parent.y]))

    neighborsEnter.append('circle')
      .attr('class', 'node-circle');
    neighborsEnter.append('text')
      .attr('class', 'node-text');
    neighborsEnter.append('text')
        .attr('class', 'node-sub-text')
    neighbors.transition().delay(durationUnit*.5).duration(durationUnit)
      .style('opacity', 1)
      .attr('transform', d3.svg.transform().translate(function(d,i) {return [d.x, d.y] }))

    neighbors.selectAll('.node-circle')
      .attr('r', function(d){return (attrs.valueKey && d.linkToEgo[attrs.valueKey] ? nodeSize(d.linkToEgo[attrs.valueKey]) : 4)*.75})
      .style('fill', function(d){return color.domain().indexOf(d.neighbor[attrs.colorKey]) >=0 ? color(d.neighbor[attrs.colorKey]) : defaultColor})

    neighbors.selectAll('.node-text')
      .data(function(d){return [d]})
      .attr('text-anchor', function(d) {
        return (d.theta + Math.HALF_PI)%Math.TWO_PI > Math.PI ? 'end' : 'start';
      }).attr('transform', d3.svg.transform().rotate(function(d){
        return (d.theta + Math.HALF_PI)%Math.TWO_PI > Math.PI ?   Math.degrees(d.theta) + 180 : Math.degrees(d.theta);
        }).translate(function(d) {
          var dx = nodeSize(attrs.valueKey ? d.linkToEgo : 1) + 2;
          return [(d.theta + Math.HALF_PI)%Math.TWO_PI > Math.PI ? -dx : dx, 0]
        }))
      .attr('dx', 0)
      .attr('dy', '.35em')
      .text(function(d) {return d.neighbor[attrs.nameKey]})


    neighbors.exit().remove();
    return _selection;
  }
  function setNeighborPos(selection,  isRest) {
    var cx = innerWidth*.5, cy =  innerHeight*.5;
    selection.each(function(d) {
      var sortVal = d.linkToEgo[attrs.sortKey];
      var radius = (sorted ? sortRadius(attrs.sortType=== 'number'?  trimValForSort(sortVal): sortVal) : netRadius);
      if (isRest) {
        radius = (sorted ? sortRadius.rangeExtent()[1]: netRadius) * 1.35;
      }
      d.x = cx+Math.cos(d.theta)*radius;
      d.y = cy+Math.sin(d.theta)*radius;
    })
    return selection;
  }

  function setNeighborInteraction(_selection) {
    function _isNeighbor(index, linkToNeighbors) {
      for (var i = 0 ; i < linkToNeighbors.length; i++) {
        if (index === linkToNeighbors[i].source
            || index === linkToNeighbors[i].target) {
          return true;
        }
      }
      return false;
    }

    _selection.on('mouseenter.neighbor', function(d){
      var thisNode= d3.select(this);
      thisNode.classed({'hover': true})
      thisNode.select('.node-circle')
        .style('fill', 'none')
        .style('stroke', function(d){return color.domain().indexOf(d.neighbor[attrs.colorKey]) >=0 ? color(d.neighbor[attrs.colorKey]) : defaultColor})
        .transition().duration(durationUnit)
        .attr('r', function(d){return profile_size*.25})


      thisNode.select('.node-text')
        .transition().duration(durationUnit)
        .attr('dx', function(){
          return d3.select(this).attr('text-anchor')==='start' ? '1.35em' : '-1.35em';
         })

      var curIndex = d[attrs.nodeKey];
      var linkToNeighbors = d.linkToNeighbors;
      d3.select(thisNode.node().parentNode)
        .selectAll('.neighbor.main')
        .filter(function(n) {
          var index = n[attrs.nodeKey];
          if (index !== curIndex) return _isNeighbor(index, linkToNeighbors);
          return false;
        }).classed({'linked':true})

      d3.select(thisNode.node().parentNode)
        .selectAll('.neighbor.main:not(.linked):not(.hover)')
        .classed('unlinked', true);

      var egoAndNeighbors = getEgoAndNeighbors(curIndex);

      var restNeighbors = egoAndNeighbors.neighbors.filter(function(n) {
        return !(_isNeighbor(n[attrs.nodeKey], linkToNeighbors)) && !(_isNeighbor(n[attrs.nodeKey], [d.linkToEgo]))
      })
      thisNode.call(drawRestNeighbors, restNeighbors);
    }).on('mouseleave.neighbor', function() {
      var thisNode = d3.select(this);
      thisNode.select('.node-circle')
          .style('fill', function(d){return color.domain().indexOf(d.neighbor[attrs.colorKey]) >=0 ? color(d.neighbor[attrs.colorKey]) : defaultColor})
          .style('stroke', 'none')
          .transition().duration(durationUnit)
          .attr('r', function(d){return attrs.valueKey && d.linkToEgo[attrs.valueKey] ? nodeSize(d.linkToEgo[attrs.valueKey]) : 4})
      thisNode.select('.node-text')
        .transition().duration(durationUnit)
        .attr('dx', 0)
      svg.selectAll('.neighbor.main')
        .classed({'hover': false, 'linked':false, 'unlinked':false})
      svg.selectAll('.neighbor.sub')
        .classed({'sub':false})
        .transition().duration(durationUnit)
        .style('opacity', 0)
        .each('end', function() {
          d3.select(this).remove();
        })
    }).on('click.neighbor', function(d) {
      d3.select(this).call(transform);
      sequence.push(d3.select(this).datum());// sequence 삽입
      sequenceDiv.call(updateSequence);
      svg.selectAll('.neighbor.main')
        .classed({'hover': false, 'linked':false, 'unlinked':false})
      d3.event.stopPropagation();
    })
  }

  function transform(_selection) { // 선택된 selection 을 중심으로 이동;
    var cur = _selection.datum();
    var egoAndNeighbors = getEgoAndNeighbors(cur[attrs.nodeKey]);
    setSortRadius(egoAndNeighbors);
    attrs.egoIndex = cur[attrs.nodeKey];

    var oldEgo = svg.selectAll('.ego')
      .classed({'ego':false, 'neighbor':true, 'main':true})
      .each(function(d){
        var n = egoAndNeighbors.neighbors.filter(function(n){
          return d[attrs.nodeKey] === n[attrs.nodeKey];
        })[0]
        d= {};
        for (var k in n) {
          d[k] = n[k];
        }
      })

    oldEgo.select('defs > clipPath > circle')
      .transition().duration(durationUnit)
      .attr('r', 0)
    oldEgo.select('.node-sub-text')
      .text('');

    var ego = _selection
      .classed({'ego': true, 'neighbor':false, 'main':false, 'hover':false})
      .each(function(d){
        d={};
        for (var k in egoAndNeighbors.ego) {
          d[k] = egoAndNeighbors.ego[k];
        }
      }).on('mouseenter.neighbor', null)
      .on('click.neighbor', null)
      .on('mouseleave.neighbor', null)
      .select('.node-circle')

    svg.selectAll('.neighbor.sub')
      .classed({'sub':false, 'main':true});

    svg.call(resetEgoAndNeighbors, egoAndNeighbors);
    return _selection;
  }

  function accessor(_attr) {
    return function(value) {
      if(value === undefined) return attrs[_attr]
      attrs[_attr] = value;
      return exports;
    }
  }
  exports['ego'] = function(_ego) {
    sequence.push(_ego);// sequence 삽입
    sequenceDiv.call(updateSequence);
    var egoAndNeighbors = getEgoAndNeighbors(_ego[attrs.nodeKey]);
    setSortRadius(egoAndNeighbors);
    svg.call(resetEgoAndNeighbors, egoAndNeighbors);
  }
  exports['search'] = function(query) {
    return search(query);
  }
  exports['sort'] = function (sortKey) {
    if (sortKey !== undefined) {
      attrs.sortKey = 'sortKey';
    }

    sorted = !sorted;
    svg.call(netInit);
    //sort;
    return exports;
  }

  exports['changeColorKey'] = function(_val) {
    attrs.colorKey = _val;
    setColorKey(linkAndNode);
    svg.selectAll('.node')
      .selectAll('.node-circle')
      .transition().duration(durationUnit)
      .style('fill', function(d){return color(d.neighbor[attrs.colorKey]);})
  }

  for (var attr in attrs) {
    if(attrs.hasOwnProperty(attr)) {
      exports[attr] = accessor(attr);
    }
  }

  return exports;
}
